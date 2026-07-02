from .database import load_custom_problems
from .models import Problem


PROBLEMS = [
    Problem(
        id="two-sum",
        title="Two Sum",
        difficulty="easy",
        topics=["arrays", "hash-map"],
        description="Return the indices of two numbers whose sum equals target. Exactly one solution exists.",
        examples=[{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}],
        test_cases=[
            {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"},
            {"input": "nums = [3,2,4], target = 6", "output": "[1,2]"},
            {"input": "nums = [3,3], target = 6", "output": "[0,1]"},
        ],
        starter_code={
            "python": "def two_sum(nums, target):\n    # Write your solution\n    pass\n",
            "javascript": "function twoSum(nums, target) {\n  // Write your solution\n}\n",
        },
    ),
    Problem(
        id="valid-parentheses",
        title="Valid Parentheses",
        difficulty="easy",
        topics=["stack", "strings"],
        description="Return true when every bracket is closed by the same type in the correct order.",
        examples=[{"input": 's = "({[]})"', "output": "true"}],
        test_cases=[
            {"input": 's = "({[]})"', "output": "true"},
            {"input": 's = "()[]{}"', "output": "true"},
            {"input": 's = "(]"', "output": "false"},
            {"input": 's = "([)]"', "output": "false"},
            {"input": 's = "{"', "output": "false"},
            {"input": 's = "}}"', "output": "false"},
        ],
        starter_code={
            "python": "def is_valid(s):\n    # Write your solution\n    pass\n",
            "javascript": "function isValid(s) {\n  // Write your solution\n}\n",
        },
    ),
    Problem(
        id="longest-substring",
        title="Longest Substring Without Repeating Characters",
        difficulty="medium",
        topics=["sliding-window", "hash-map"],
        description="Return the length of the longest substring containing no repeated characters.",
        examples=[{"input": 's = "abcabcbb"', "output": "3"}],
        test_cases=[
            {"input": 's = "abcabcbb"', "output": "3"},
            {"input": 's = "bbbbb"', "output": "1"},
            {"input": 's = "pwwkew"', "output": "3"},
            {"input": 's = ""', "output": "0"},
        ],
        starter_code={
            "python": "def longest_unique(s):\n    # Write your solution\n    pass\n",
            "javascript": "function longestUnique(s) {\n  // Write your solution\n}\n",
        },
    ),
    Problem(
        id="deepmind-watermelon",
        title="Watermelon",
        difficulty="easy",
        topics=["math", "brute-force"],
        description=(
            "Given the integer weight of a watermelon, determine whether it can be "
            "split into two positive parts that both have even weights."
        ),
        examples=[{"input": "w = 8", "output": "YES"}],
        test_cases=[
            {"input": "w = 8", "output": "YES"},
            {"input": "w = 2", "output": "NO"},
            {"input": "w = 10", "output": "YES"},
            {"input": "w = 3", "output": "NO"},
        ],
        starter_code={
            "python": "def can_split_evenly(weight):\n    # Return \"YES\" or \"NO\"\n    pass\n",
            "javascript": "function canSplitEvenly(weight) {\n  // Return \"YES\" or \"NO\"\n}\n",
        },
        source="Google DeepMind CodeContests · Codeforces",
        source_url="https://github.com/google-deepmind/code_contests",
        license="CC BY 4.0; original-source terms may also apply",
    ),
    Problem(
        id="deepmind-way-too-long-words",
        title="Way Too Long Words",
        difficulty="easy",
        topics=["strings", "implementation"],
        description=(
            "Abbreviate every word longer than 10 characters using its first letter, "
            "the count of omitted letters, and its last letter. Leave shorter words unchanged."
        ),
        examples=[
            {"input": 'word = "localization"', "output": '"l10n"'},
            {"input": 'word = "word"', "output": '"word"'},
        ],
        test_cases=[
            {"input": 'word = "localization"', "output": '"l10n"'},
            {"input": 'word = "word"', "output": '"word"'},
            {"input": 'word = "internationalization"', "output": '"i18n"'},
            {"input": 'word = "apple"', "output": '"apple"'},
        ],
        starter_code={
            "python": "def abbreviate(word):\n    # Write your solution\n    pass\n",
            "javascript": "function abbreviate(word) {\n  // Write your solution\n}\n",
        },
        source="Google DeepMind CodeContests · Codeforces",
        source_url="https://github.com/google-deepmind/code_contests",
        license="CC BY 4.0; original-source terms may also apply",
    ),
    Problem(
        id="deepmind-team",
        title="Team",
        difficulty="easy",
        topics=["implementation", "counting"],
        description=(
            "Three teammates each state whether they know how to solve a problem. "
            "Count how many problems the team will attempt when at least two teammates agree."
        ),
        examples=[
            {
                "input": "opinions = [[1,1,0], [1,1,1], [1,0,0]]",
                "output": "2",
            }
        ],
        test_cases=[
            {"input": "opinions = [[1,1,0], [1,1,1], [1,0,0]]", "output": "2"},
            {"input": "opinions = [[1,0,0], [0,1,1], [1,1,0]]", "output": "2"},
            {"input": "opinions = [[0,0,0], [0,0,1]]", "output": "0"},
        ],
        starter_code={
            "python": "def attempted_count(opinions):\n    # Write your solution\n    pass\n",
            "javascript": "function attemptedCount(opinions) {\n  // Write your solution\n}\n",
        },
        source="Google DeepMind CodeContests · Codeforces",
        source_url="https://github.com/google-deepmind/code_contests",
        license="CC BY 4.0; original-source terms may also apply",
    ),
]


def all_problems() -> list[Problem]:
    items = []
    for problem in PROBLEMS + [Problem.model_validate(item) for item in load_custom_problems()]:
        if not problem.test_cases and problem.examples:
            problem.test_cases = list(problem.examples)
        items.append(problem)
    return items


def get_problem(problem_id: str) -> Problem | None:
    return next((problem for problem in all_problems() if problem.id == problem_id), None)


def search_problems(
    query: str = "", topics: list[str] | None = None, difficulty: str | None = None
) -> list[Problem]:
    words = query.lower().split()
    requested_topics = {topic.lower() for topic in topics or []}
    matches = []
    for problem in all_problems():
        haystack = " ".join(
            [problem.title, problem.description, *problem.topics]
        ).lower()
        if words and not all(word in haystack for word in words):
            continue
        if requested_topics and not requested_topics.issubset(
            {topic.lower() for topic in problem.topics}
        ):
            continue
        if difficulty and problem.difficulty != difficulty:
            continue
        matches.append(problem)
    return matches


def select_problem(
    difficulty: str, exclude: set[str] | None = None, problem_id: str | None = None
) -> Problem:
    if problem_id:
        selected = get_problem(problem_id)
        if selected:
            return selected
    exclude = exclude or set()
    problems = all_problems()
    candidates = [p for p in problems if p.difficulty == difficulty and p.id not in exclude]
    if not candidates:
        candidates = [p for p in problems if p.id not in exclude] or problems
    return candidates[0]
