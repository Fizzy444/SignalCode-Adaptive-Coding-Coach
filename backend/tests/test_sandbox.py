from backend.app.sandbox import run_code


def test_python_execution():
    result = run_code("python", "print(sum([2, 3, 5]))")
    assert result.exit_code == 0
    assert result.output == "10"


def test_javascript_execution():
    result = run_code("javascript", "console.log([2, 3, 5].reduce((a, b) => a + b, 0))")
    assert result.exit_code == 0
    assert result.output == "10"


def test_python_blocks_process_access():
    result = run_code("python", "import subprocess")
    assert result.exit_code == 1
    assert result.output.startswith("SandboxError:")


def test_timeout():
    result = run_code("python", "while True: pass")
    assert result.timed_out is True


def test_python_test_cases():
    code = """
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
"""
    test_cases = [
        {"name": "Test 1", "input": "nums = [2, 7, 11, 15], target = 9", "output": "[0, 1]"},
        {"name": "Test 2", "input": "nums = [3, 2, 4], target = 6", "output": "[1, 2]"}
    ]
    result = run_code("python", code, test_cases=test_cases)
    assert result.passed is True
    assert result.test_results is not None
    assert len(result.test_results) == 2
    assert all(tc.passed for tc in result.test_results)


def test_javascript_test_cases():
    code = """
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
}
"""
    test_cases = [
        {"name": "Test 1", "input": "nums = [2, 7, 11, 15], target = 9", "output": "[0, 1]"},
        {"name": "Test 2", "input": "nums = [3, 2, 4], target = 6", "output": "[1, 2]"}
    ]
    result = run_code("javascript", code, test_cases=test_cases)
    assert result.passed is True
    assert result.test_results is not None
    assert len(result.test_results) == 2
    assert all(tc.passed for tc in result.test_results)

