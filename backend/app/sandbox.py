"""Guarded local code runner.

This is deliberately dependency-free and useful for a single-user local MVP.
For an internet-facing multi-tenant deployment, run this API behind a container
or microVM executor as an additional security boundary.
"""

import ast
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from .models import CodeRunResult, TestCaseResult


TIMEOUT_SECONDS = 3
MAX_OUTPUT_BYTES = 16_384
BLOCKED_PYTHON_NAMES = {
    "__import__", "breakpoint", "compile", "eval", "exec", "globals", "help",
    "input", "locals", "open", "vars",
}
BLOCKED_PYTHON_MODULES = {
    "ctypes", "http", "multiprocessing", "os", "pathlib", "shutil", "signal",
    "socket", "subprocess", "sys", "urllib",
}


def _validate_python(code: str) -> str | None:
    try:
        tree = ast.parse(code)
    except SyntaxError as error:
        return f"SyntaxError: {error.msg} (line {error.lineno})"
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            modules = (
                [alias.name.split(".")[0] for alias in node.names]
                if isinstance(node, ast.Import)
                else [(node.module or "").split(".")[0]]
            )
            if any(module in BLOCKED_PYTHON_MODULES for module in modules):
                return "SandboxError: filesystem, process, and network modules are disabled."
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in BLOCKED_PYTHON_NAMES:
                return f"SandboxError: {node.func.id}() is disabled."
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            return "SandboxError: dunder attribute access is disabled."
    return None


def _validate_javascript(code: str) -> str | None:
    compact = code.lower()
    blocked = [
        "require(", "import(", "from 'node:", 'from "node:', "process.",
        "child_process", "worker_threads", "fetch(", "websocket",
    ]
    if any(token in compact for token in blocked):
        return "SandboxError: filesystem, process, and network APIs are disabled."
    return None


def _validate_java(code: str) -> str | None:
    compact = re.sub(r"\s+", "", code).lower()
    blocked = [
        "java.io.", "java.nio.", "java.net.", "java.lang.reflect.",
        "java.lang.runtime", "runtime.getruntime(", "java.lang.process", "processbuilder",
        "system.exit(", "system.load(", "system.loadlibrary(",
    ]
    if any(token in compact for token in blocked):
        return "SandboxError: filesystem, process, network, and reflection APIs are disabled."
    return None


def _java_main_class(code: str) -> str | None:
    public_class = re.search(
        r"\bpublic\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_$][\w$]*)",
        code,
    )
    if public_class:
        return public_class.group(1)
    any_class = re.search(r"\bclass\s+([A-Za-z_$][\w$]*)", code)
    return any_class.group(1) if any_class else None


def _generate_python_harness(test_cases: list[dict[str, str]]) -> str:
    tc_json = json.dumps(test_cases)
    return f"""

import sys
import json
import ast

_signalcode_tests = json.loads({repr(tc_json)})
_signalcode_results = []

_candidates = [_val for _name, _val in list(globals().items()) if callable(_val) and not _name.startswith("_") and hasattr(_val, "__code__") and hasattr(_val, "__module__") and _val.__module__ == __name__]
_candidate_fn = None
for _idx, _tc in enumerate(_signalcode_tests):
    _name = _tc.get("name") or f"Test {{_idx + 1}}"
    _input_str = _tc.get("input", "").strip()
    _expected_str = _tc.get("expected") or _tc.get("output", "")
    _actual_str = ""
    _passed = False
    _error = None
    try:
        if not _candidates:
            raise RuntimeError("No top-level function found to test.")
        
        _local_vars = {{}}
        if "=" in _input_str:
            _lines = []
            _curr = []
            _depth = 0
            for _char in _input_str:
                if _char in "[{{(": _depth += 1
                elif _char in "]}})": _depth -= 1
                if _char == "," and _depth == 0:
                    _lines.append("".join(_curr).strip())
                    _curr = []
                else:
                    _curr.append(_char)
            if _curr:
                _lines.append("".join(_curr).strip())
            _exec_str = "\\n".join(_lines)
            exec(_exec_str, {{}}, _local_vars)
            _args = list(_local_vars.values())
        else:
            _eval_val = eval(f"({{_input_str}},)") if _input_str else ()
            _args = list(_eval_val)
            
        _candidate_fn = None
        for _fn in reversed(_candidates):
            if _fn.__code__.co_argcount == len(_args):
                _candidate_fn = _fn
                break
        if not _candidate_fn:
            _candidate_fn = _candidates[-1]
            
        _res = _candidate_fn(*_args)
        
        if isinstance(_res, (list, dict, tuple)):
            _actual_str = json.dumps(_res)
        elif isinstance(_res, bool):
            _actual_str = "true" if _res else "false"
        else:
            _actual_str = str(_res)
            
        try:
            if _expected_str.lower() in ("true", "false", "null"):
                _exp_val = json.loads(_expected_str.lower())
            else:
                _exp_val = ast.literal_eval(_expected_str)
        except Exception:
            try:
                _exp_val = json.loads(_expected_str)
            except Exception:
                _exp_val = _expected_str
                
        if _res == _exp_val or str(_actual_str).strip().lower() == str(_expected_str).strip().lower() or str(_res).strip().lower() == str(_expected_str).strip().lower():
            _passed = True
        else:
            _passed = False
    except Exception as _e:
        _passed = False
        _error = f"{{type(_e).__name__}}: {{str(_e)}}"
        
    _signalcode_results.append({{
        "name": _name,
        "input": _input_str,
        "expected": _expected_str,
        "actual": _actual_str,
        "passed": _passed,
        "error": _error
    }})

print("\\n---SIGNALCODE_TEST_RESULTS---")
print(json.dumps(_signalcode_results))
"""


def _generate_javascript_harness(code: str, test_cases: list[dict[str, str]]) -> str:
    tc_json = json.dumps(test_cases)
    found_names = []
    for m in re.findall(r'(?:function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)|(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=)', code):
        found_names.extend([n for n in m if n])
    common_names = ["twoSum", "isValid", "longestUnique", "canSplitEvenly", "abbreviate", "attemptedCount", "reverse", "solution", "two_sum", "is_valid", "longest_unique", "can_split_evenly", "attempted_count"]
    all_names = list(dict.fromkeys(found_names + common_names))
    names_json = json.dumps(all_names)
    return f"""

const _signalcode_tests = {tc_json};
const _signalcode_results = [];

let _candidate_fn = null;
const _candidate_names = {names_json};
for (const _name of _candidate_names) {{
  try {{
    const _val = eval(_name);
    if (typeof _val === 'function') {{
      _candidate_fn = _val;
      break;
    }}
  }} catch (e) {{}}
}}

for (let _idx = 0; _idx < _signalcode_tests.length; _idx++) {{
  const _tc = _signalcode_tests[_idx];
  const _name = _tc.name || `Test {{_idx + 1}}`;
  const _input_str = (_tc.input || "").trim();
  const _expected_str = _tc.expected || _tc.output || "";
  let _actual_str = "";
  let _passed = false;
  let _error = null;
  try {{
    if (!_candidate_fn) {{
      throw new Error("No function found to test.");
    }}
    let _args = [];
    if (_input_str.includes("=")) {{
      let _lines = [];
      let _curr = "";
      let _depth = 0;
      for (const _char of _input_str) {{
        if ("[{{(".includes(_char)) _depth++;
        else if ("]}})".includes(_char)) _depth--;
        if (_char === "," && _depth === 0) {{
          _lines.push(_curr.trim());
          _curr = "";
        }} else {{
          _curr += _char;
        }}
      }}
      if (_curr.trim()) _lines.push(_curr.trim());
      
      const _varNames = _lines.map(l => {{
        const m = l.match(/([a-zA-Z_$][0-9a-zA-Z_$]*)\\s*=/);
        return m ? m[1] : null;
      }}).filter(Boolean);
      
      const _exec_code = _lines.map(l => `let ${{l}};`).join(" ") + ` return [${{_varNames.join(", ")}}];`;
      _args = new Function(_exec_code)();
    }} else {{
      _args = new Function(`return [${{_input_str}}];`)();
    }}
    
    const _res = _candidate_fn(..._args);
    if (typeof _res === 'object' && _res !== null) {{
      _actual_str = JSON.stringify(_res);
    }} else {{
      _actual_str = String(_res);
    }}
    
    let _exp_val = _expected_str;
    try {{
      const _low = _expected_str.toLowerCase();
      if (_low === "true" || _low === "false" || _low === "null" || _expected_str.startsWith("[") || _expected_str.startsWith("{{") || !isNaN(Number(_expected_str))) {{
        _exp_val = JSON.parse(_expected_str);
      }}
    }} catch (e) {{}}
    
    const _res_str = typeof _res === 'object' && _res !== null ? JSON.stringify(_res) : String(_res);
    const _exp_str_norm = typeof _exp_val === 'object' && _exp_val !== null ? JSON.stringify(_exp_val) : String(_exp_val);
    
    if (_res_str.trim().toLowerCase() === _exp_str_norm.trim().toLowerCase() || String(_actual_str).trim().toLowerCase() === String(_expected_str).trim().toLowerCase()) {{
      _passed = true;
    }} else {{
      _passed = false;
    }}
  }} catch (e) {{
    _passed = false;
    _error = `${{e.name || 'Error'}}: ${{e.message || String(e)}}`;
  }}
  _signalcode_results.push({{
    name: _name,
    input: _input_str,
    expected: _expected_str,
    actual: _actual_str,
    passed: _passed,
    error: _error
  }});
}}
console.log("\\n---SIGNALCODE_TEST_RESULTS---");
console.log(JSON.stringify(_signalcode_results));
"""


def run_code(language: str, code: str, problem_id: str | None = None, test_cases: list[dict[str, str]] | None = None) -> CodeRunResult:
    validators = {
        "python": _validate_python,
        "javascript": _validate_javascript,
        "java": _validate_java,
    }
    validator = validators.get(language)
    if validator is None:
        return CodeRunResult(
            output=f"RuntimeError: unsupported language '{language}'.",
            exit_code=1,
            passed=False,
        )
    validation_error = validator(code)
    if validation_error:
        return CodeRunResult(output=validation_error, exit_code=1, passed=False)

    if language == "java" and test_cases:
        return CodeRunResult(
            output="SandboxError: Java test-case harnesses are not supported yet; run a complete program with main().",
            exit_code=1,
            passed=False,
        )

    suffix = {"python": ".py", "javascript": ".js", "java": ".java"}[language]
    executable = {"python": "python", "javascript": "node", "java": "java"}[language]
    args = [executable]
    if language == "python":
        args.extend(["-I", "-B"])

    run_source_code = code
    if test_cases:
        if language == "python":
            run_source_code += _generate_python_harness(test_cases)
        else:
            run_source_code += _generate_javascript_harness(code, test_cases)

    with tempfile.TemporaryDirectory(prefix="signalcode-run-") as directory:
        java_class = _java_main_class(code) if language == "java" else None
        if language == "java" and not java_class:
            return CodeRunResult(
                output="CompileError: Java code must declare a class containing main().",
                exit_code=1,
                passed=False,
            )
        source = Path(directory) / f"{java_class or 'main'}{suffix}"
        source.write_text(run_source_code, encoding="utf-8")
        if language == "java":
            args.extend(["-cp", directory, java_class])
        else:
            args.append(str(source))
        environment = {
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "WINDIR": os.environ.get("WINDIR", ""),
            "TEMP": directory,
            "TMP": directory,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONHASHSEED": "0",
            "NO_COLOR": "1",
        }
        try:
            if language == "java":
                compiled = subprocess.run(
                    ["javac", "-encoding", "UTF-8", "-d", directory, str(source)],
                    cwd=directory,
                    env=environment,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    timeout=TIMEOUT_SECONDS,
                    check=False,
                    creationflags=(
                        subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                    ),
                )
                if compiled.returncode != 0:
                    compile_output = compiled.stdout[:MAX_OUTPUT_BYTES].decode(
                        "utf-8", errors="replace"
                    )
                    return CodeRunResult(
                        output=compile_output.rstrip(),
                        exit_code=compiled.returncode,
                        passed=False,
                    )
            completed = subprocess.run(
                args,
                cwd=directory,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=TIMEOUT_SECONDS,
                check=False,
                creationflags=(
                    subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                ),
            )
        except subprocess.TimeoutExpired as error:
            partial = (error.stdout or b"")[:MAX_OUTPUT_BYTES].decode(
                "utf-8", errors="replace"
            )
            message = f"{partial}\nExecution timed out after {TIMEOUT_SECONDS}s.".strip()
            return CodeRunResult(output=message, timed_out=True, passed=False)
        except FileNotFoundError:
            missing_runtime = "javac/JDK" if language == "java" else executable
            return CodeRunResult(
                output=f"RuntimeError: {missing_runtime} is not installed on the server.",
                exit_code=127,
                passed=False,
            )

    output = completed.stdout[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")
    if len(completed.stdout) > MAX_OUTPUT_BYTES:
        output += "\n… output truncated by sandbox"

    test_results = None
    passed = None
    if "---SIGNALCODE_TEST_RESULTS---" in output:
        parts = output.split("---SIGNALCODE_TEST_RESULTS---", 1)
        output = parts[0].strip()
        if not output:
            output = "Code ran successfully with no console output."
        try:
            raw_results = json.loads(parts[1].strip())
            test_results = [TestCaseResult.model_validate(item) for item in raw_results]
            passed = all(tc.passed for tc in test_results) and completed.returncode == 0
        except Exception as e:
            output += f"\n[Error parsing test results: {e}]"
            passed = False
    elif completed.returncode == 0:
        if not output.strip():
            output = "Code ran successfully with no output."
    else:
        passed = False

    return CodeRunResult(
        output=output.rstrip(),
        exit_code=completed.returncode,
        timed_out=False,
        passed=passed,
        test_results=test_results,
    )
