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
        id="roman-to-integer",
        title="Roman to Integer",
        difficulty="easy",
        topics=["hash-table", "math", "strings"],
        description="Roman numerals are represented by seven different symbols: I, V, X, L, C, D and M. Given a roman numeral, convert it to an integer.",
        examples=[
            {"input": 's = "III"', "output": "3"},
            {"input": 's = "LVIII"', "output": "58"},
            {"input": 's = "MCMXCIV"', "output": "1994"},
        ],
        test_cases=[
            {"input": 's = "III"', "output": "3"},
            {"input": 's = "LVIII"', "output": "58"},
            {"input": 's = "MCMXCIV"', "output": "1994"},
            {"input": 's = "IX"', "output": "9"},
            {"input": 's = "IV"', "output": "4"},
        ],
        starter_code={
            "python": "def roman_to_int(s):\n    # Write your solution\n    pass\n",
            "javascript": "function romanToInt(s) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/roman-to-integer/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="palindrome-number",
        title="Palindrome Number",
        difficulty="easy",
        topics=["math"],
        description="Given an integer x, return true if x is a palindrome, and false otherwise.",
        examples=[
            {"input": "x = 121", "output": "true"},
            {"input": "x = -121", "output": "false"},
        ],
        test_cases=[
            {"input": "x = 121", "output": "true"},
            {"input": "x = -121", "output": "false"},
            {"input": "x = 10", "output": "false"},
            {"input": "x = 0", "output": "true"},
        ],
        starter_code={
            "python": "def is_palindrome(x):\n    # Write your solution\n    pass\n",
            "javascript": "function isPalindrome(x) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/palindrome-number/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="reverse-linked-list",
        title="Reverse Linked List",
        difficulty="easy",
        topics=["linked-list", "recursion"],
        description="Given the head of a singly linked list, reverse the list, and return the reversed list represented as an array.",
        examples=[
            {"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]"},
        ],
        test_cases=[
            {"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]"},
            {"input": "head = [1,2]", "output": "[2,1]"},
            {"input": "head = []", "output": "[]"},
        ],
        starter_code={
            "python": "def reverse_list(head):\n    # Write your solution\n    pass\n",
            "javascript": "function reverseList(head) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/reverse-linked-list/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="merge-two-sorted-lists",
        title="Merge Two Sorted Lists",
        difficulty="easy",
        topics=["linked-list", "recursion"],
        description="You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list.",
        examples=[
            {"input": "list1 = [1,2,4], list2 = [1,3,4]", "output": "[1,1,2,3,4,4]"},
        ],
        test_cases=[
            {"input": "list1 = [1,2,4], list2 = [1,3,4]", "output": "[1,1,2,3,4,4]"},
            {"input": "list1 = [], list2 = []", "output": "[]"},
            {"input": "list1 = [], list2 = [0]", "output": "[0]"},
        ],
        starter_code={
            "python": "def merge_two_lists(list1, list2):\n    # Write your solution\n    pass\n",
            "javascript": "function mergeTwoLists(list1, list2) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/merge-two-sorted-lists/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="best-time-to-buy-and-sell-stock",
        title="Best Time to Buy and Sell Stock",
        difficulty="easy",
        topics=["arrays", "dynamic-programming"],
        description="You are given an array prices where prices[i] is the price of a given stock on the ith day. Return the maximum profit you can achieve from this transaction.",
        examples=[
            {"input": "prices = [7,1,5,3,6,4]", "output": "5"},
        ],
        test_cases=[
            {"input": "prices = [7,1,5,3,6,4]", "output": "5"},
            {"input": "prices = [7,6,4,3,1]", "output": "0"},
            {"input": "prices = [2,4,1]", "output": "2"},
        ],
        starter_code={
            "python": "def max_profit(prices):\n    # Write your solution\n    pass\n",
            "javascript": "function maxProfit(prices) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="valid-anagram",
        title="Valid Anagram",
        difficulty="easy",
        topics=["hash-table", "strings", "sorting"],
        description="Given two strings s and t, return true if t is an anagram of s, and false otherwise.",
        examples=[
            {"input": 's = "anagram", t = "nagaram"', "output": "true"},
            {"input": 's = "rat", t = "car"', "output": "false"},
        ],
        test_cases=[
            {"input": 's = "anagram", t = "nagaram"', "output": "true"},
            {"input": 's = "rat", t = "car"', "output": "false"},
            {"input": 's = "a", t = "a"', "output": "true"},
        ],
        starter_code={
            "python": "def is_anagram(s, t):\n    # Write your solution\n    pass\n",
            "javascript": "function isAnagram(s, t) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/valid-anagram/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="maximum-subarray",
        title="Maximum Subarray",
        difficulty="medium",
        topics=["arrays", "dynamic-programming"],
        description="Given an integer array nums, find the subarray with the largest sum, and return its sum.",
        examples=[
            {"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6"},
        ],
        test_cases=[
            {"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6"},
            {"input": "nums = [1]", "output": "1"},
            {"input": "nums = [5,4,-1,7,8]", "output": "23"},
        ],
        starter_code={
            "python": "def max_sub_array(nums):\n    # Write your solution\n    pass\n",
            "javascript": "function maxSubArray(nums) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/maximum-subarray/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="climbing-stairs",
        title="Climbing Stairs",
        difficulty="easy",
        topics=["math", "dynamic-programming"],
        description="You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
        examples=[
            {"input": "n = 2", "output": "2"},
            {"input": "n = 3", "output": "3"},
        ],
        test_cases=[
            {"input": "n = 2", "output": "2"},
            {"input": "n = 3", "output": "3"},
            {"input": "n = 5", "output": "8"},
        ],
        starter_code={
            "python": "def climb_stairs(n):\n    # Write your solution\n    pass\n",
            "javascript": "function climbStairs(n) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/climbing-stairs/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="binary-search",
        title="Binary Search",
        difficulty="easy",
        topics=["arrays", "binary-search"],
        description="Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.",
        examples=[
            {"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4"},
            {"input": "nums = [-1,0,3,5,9,12], target = 2", "output": "-1"},
        ],
        test_cases=[
            {"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4"},
            {"input": "nums = [-1,0,3,5,9,12], target = 2", "output": "-1"},
            {"input": "nums = [5], target = 5", "output": "0"},
        ],
        starter_code={
            "python": "def search(nums, target):\n    # Write your solution\n    pass\n",
            "javascript": "function search(nums, target) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/binary-search/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="invert-binary-tree",
        title="Invert Binary Tree",
        difficulty="easy",
        topics=["tree", "depth-first-search", "breadth-first-search"],
        description="Given the root of a binary tree represented as an array in level-order traversal, invert the tree, and return its array representation.",
        examples=[
            {"input": "root = [4,2,7,1,3,6,9]", "output": "[4,7,2,9,6,3,1]"},
        ],
        test_cases=[
            {"input": "root = [4,2,7,1,3,6,9]", "output": "[4,7,2,9,6,3,1]"},
            {"input": "root = [2,1,3]", "output": "[2,3,1]"},
            {"input": "root = []", "output": "[]"},
        ],
        starter_code={
            "python": "def invert_tree(root):\n    # Write your solution\n    pass\n",
            "javascript": "function invertTree(root) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/invert-binary-tree/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="linked-list-cycle",
        title="Linked List Cycle",
        difficulty="easy",
        topics=["hash-table", "linked-list", "two-pointers"],
        description="Given head, the head of a linked list, determine if the linked list has a cycle in it.",
        examples=[
            {"input": "head = [3,2,0,-4], pos = 1", "output": "true"},
            {"input": "head = [1], pos = -1", "output": "false"},
        ],
        test_cases=[
            {"input": "head = [3,2,0,-4], pos = 1", "output": "true"},
            {"input": "head = [1], pos = -1", "output": "false"},
        ],
        starter_code={
            "python": "def has_cycle(head):\n    # Write your solution\n    pass\n",
            "javascript": "function hasCycle(head) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/linked-list-cycle/",
        license="CC BY-SA 4.0",
    ),
    Problem(
        id="3sum",
        title="3Sum",
        difficulty="medium",
        topics=["arrays", "two-pointers", "sorting"],
        description="Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.",
        examples=[
            {"input": "nums = [-1,0,1,2,-1,-4]", "output": "[[-1,-1,2],[-1,0,1]]"},
            {"input": "nums = [0,1,1]", "output": "[]"},
        ],
        test_cases=[
            {"input": "nums = [-1,0,1,2,-1,-4]", "output": "[[-1,-1,2],[-1,0,1]]"},
            {"input": "nums = [0,1,1]", "output": "[]"},
            {"input": "nums = [0,0,0]", "output": "[[0,0,0]]"},
        ],
        starter_code={
            "python": "def three_sum(nums):\n    # Write your solution\n    pass\n",
            "javascript": "function threeSum(nums) {\n  // Write your solution\n}\n",
        },
        source="LeetCode",
        source_url="https://leetcode.com/problems/3sum/",
        license="CC BY-SA 4.0",
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
