# Supported functions

GridCalc implements **96 functions** in its own formula engine (no third-party formula library).
Optional arguments are shown in `[brackets]`. Function names are case-insensitive.

> Generated from `src/engine/functions` by `npm run docs:functions`.

## Contents

- [Math](#math) (24)
- [Statistical](#statistical) (19)
- [Logical](#logical) (12)
- [Lookup](#lookup) (9)
- [Text](#text) (21)
- [Information](#information) (11)

## Math

| Function | Description | Example |
| --- | --- | --- |
| `ABS(number)` | Absolute value of a number. | `=ABS(-4)` |
| `CEILING(number, [significance])` | Rounds up to the nearest multiple of significance (default 1). | `=CEILING(4.3, 0.5)` |
| `EXP(number)` | e raised to the given power. | `=EXP(1)` |
| `FLOOR(number, [significance])` | Rounds down to the nearest multiple of significance (default 1). | `=FLOOR(4.7, 0.5)` |
| `INT(number)` | Rounds down to the nearest integer. | `=INT(-2.5)` |
| `LN(number)` | Natural logarithm. | `=LN(10)` |
| `LOG(number, [base])` | Logarithm in the given base (default 10). | `=LOG(8, 2)` |
| `LOG10(number)` | Base-10 logarithm. | `=LOG10(1000)` |
| `MOD(number, divisor)` | Remainder after division; the result has the sign of the divisor. | `=MOD(10, 3)` |
| `PI()` | The constant π. | `=PI()*2` |
| `POWER(number, power)` | Raises a number to a power (same as ^). | `=POWER(2, 10)` |
| `PRODUCT(number1, [number2], ...)` | Multiplies all numbers. | `=PRODUCT(A1:A3)` |
| `RAND()` | Random number in [0, 1). Volatile: recalculates on every change (or F9). *(volatile)* | `=RAND()` |
| `RANDBETWEEN(bottom, top)` | Random integer between bottom and top, inclusive. Volatile. *(volatile)* | `=RANDBETWEEN(1, 6)` |
| `ROUND(number, [digits])` | Rounds half away from zero to the given number of digits (negative digits round left of the decimal point). | `=ROUND(3.14159, 2)` |
| `ROUNDDOWN(number, [digits])` | Rounds toward zero. | `=ROUNDDOWN(3.149, 2)` |
| `ROUNDUP(number, [digits])` | Rounds away from zero. | `=ROUNDUP(3.141, 1)` |
| `SIGN(number)` | Returns 1, 0 or -1 depending on the sign of the number. | `=SIGN(-3)` |
| `SQRT(number)` | Square root. | `=SQRT(16)` |
| `SUM(number1, [number2], ...)` | Adds all numbers. Text and blanks inside ranges are ignored. | `=SUM(A1:A10, 5)` |
| `SUMIF(range, criterion, [sum_range])` | Sums cells that meet a criterion such as ">10", "apple" or "a*". | `=SUMIF(B2:B10, "North", C2:C10)` |
| `SUMIFS(sum_range, criteria_range1, criterion1, ...)` | Sums cells that meet every criterion. | `=SUMIFS(C2:C10, B2:B10, "North", C2:C10, ">100")` |
| `SUMPRODUCT(array1, [array2], ...)` | Multiplies corresponding entries of same-sized ranges and sums the products. Non-numbers count as 0. | `=SUMPRODUCT(B2:B5, C2:C5)` |
| `TRUNC(number, [digits])` | Truncates a number to the given digits by removing the fractional part. | `=TRUNC(8.97)` |

## Statistical

| Function | Description | Example |
| --- | --- | --- |
| `AVERAGE(number1, [number2], ...)` | Arithmetic mean of the numbers. | `=AVERAGE(B2:B20)` |
| `AVERAGEIF(range, criterion, [average_range])` | Averages cells that meet a criterion. | `=AVERAGEIF(B2:B10, "North", C2:C10)` |
| `COUNT(value1, [value2], ...)` | Counts how many values are numbers. | `=COUNT(A1:A10)` |
| `COUNTA(value1, [value2], ...)` | Counts non-empty values (including text and errors). | `=COUNTA(A1:A10)` |
| `COUNTBLANK(range)` | Counts empty cells (and cells containing empty text). | `=COUNTBLANK(A1:A10)` |
| `COUNTIF(range, criterion)` | Counts cells that meet a criterion. | `=COUNTIF(A1:A10, ">=50")` |
| `COUNTIFS(criteria_range1, criterion1, ...)` | Counts rows that meet every criterion. | `=COUNTIFS(B2:B10, "North", C2:C10, ">100")` |
| `LARGE(range, k)` | The k-th largest number. | `=LARGE(A1:A10, 2)` |
| `MAX(number1, [number2], ...)` | Largest number (0 if there are none). | `=MAX(A1:A100)` |
| `MAXIFS(max_range, criteria_range1, criterion1, ...)` | Largest value among cells that meet every criterion (0 if none). | `=MAXIFS(C2:C10, B2:B10, "North")` |
| `MEDIAN(number1, [number2], ...)` | Middle value of the numbers. | `=MEDIAN(A1:A9)` |
| `MIN(number1, [number2], ...)` | Smallest number (0 if there are none). | `=MIN(A1:A100)` |
| `MINIFS(min_range, criteria_range1, criterion1, ...)` | Smallest value among cells that meet every criterion (0 if none). | `=MINIFS(C2:C10, B2:B10, "North")` |
| `RANK(number, range, [ascending])` | Rank of a number within a range (descending by default; pass 1 for ascending). | `=RANK(B2, B$2:B$10)` |
| `SMALL(range, k)` | The k-th smallest number. | `=SMALL(A1:A10, 1)` |
| `STDEV(number1, [number2], ...)` | Sample standard deviation. | `=STDEV(A1:A10)` |
| `STDEVP(number1, [number2], ...)` | Population standard deviation. | `=STDEVP(A1:A10)` |
| `VAR(number1, [number2], ...)` | Sample variance. | `=VAR(A1:A10)` |
| `VARP(number1, [number2], ...)` | Population variance. | `=VARP(A1:A10)` |

## Logical

| Function | Description | Example |
| --- | --- | --- |
| `AND(logical1, [logical2], ...)` | TRUE if every argument is TRUE. | `=AND(A1>0, B1>0)` |
| `CHOOSE(index, value1, [value2], ...)` | Returns the value at the given 1-based index. | `=CHOOSE(2, "red", "green", "blue")` |
| `FALSE()` | The logical value FALSE. |  |
| `IF(condition, value_if_true, [value_if_false])` | Returns one value if the condition is TRUE and another if it is FALSE. Only the chosen branch is evaluated. | `=IF(A1>=50, "Pass", "Fail")` |
| `IFERROR(value, value_if_error)` | Returns value, or value_if_error if value is any error. | `=IFERROR(A1/B1, 0)` |
| `IFNA(value, value_if_na)` | Returns value, or value_if_na if value is #N/A. | `=IFNA(VLOOKUP("x", A1:B9, 2, FALSE), "missing")` |
| `IFS(condition1, value1, [condition2, value2], ...)` | Returns the value for the first TRUE condition; #N/A if none is TRUE. | `=IFS(A1>=90, "A", A1>=80, "B", TRUE, "C")` |
| `NOT(logical)` | Reverses a TRUE/FALSE value. | `=NOT(A1>5)` |
| `OR(logical1, [logical2], ...)` | TRUE if any argument is TRUE. | `=OR(A1="yes", B1="yes")` |
| `SWITCH(expression, value1, result1, [value2, result2], ..., [default])` | Compares an expression against a list of values and returns the matching result. | `=SWITCH(A1, 1, "One", 2, "Two", "Other")` |
| `TRUE()` | The logical value TRUE. |  |
| `XOR(logical1, [logical2], ...)` | TRUE if an odd number of arguments are TRUE. | `=XOR(A1, B1)` |

## Lookup

| Function | Description | Example |
| --- | --- | --- |
| `COLUMN([reference])` | Column number of a reference, or of the current cell. | `=COLUMN(C1)` |
| `COLUMNS(range)` | Number of columns in a range. | `=COLUMNS(A1:C10)` |
| `HLOOKUP(lookup_value, table, row_index, [approximate])` | Like VLOOKUP, but searches the first row and returns a value from row_index. | `=HLOOKUP("Q2", A1:E5, 3, FALSE)` |
| `INDEX(range, row, [column])` | Value at the given 1-based row and column of a range. For a single row/column, one index is enough. | `=INDEX(A1:C10, 3, 2)` |
| `MATCH(lookup_value, range, [match_type])` | Position of lookup_value in a row/column. match_type 1 (default): largest value ≤ lookup in ascending data; 0: exact; -1: smallest value ≥ lookup in descending data. | `=MATCH("Bob", A1:A10, 0)` |
| `ROW([reference])` | Row number of a reference, or of the current cell. | `=ROW(B7)` |
| `ROWS(range)` | Number of rows in a range. | `=ROWS(A1:C10)` |
| `VLOOKUP(lookup_value, table, col_index, [approximate])` | Finds lookup_value in the first column of table and returns the value from col_index in the same row. approximate defaults to TRUE (sorted data); use FALSE for an exact match. Text matching is case-insensitive and supports * and ? wildcards. | `=VLOOKUP("Widget", A2:D20, 4, FALSE)` |
| `XLOOKUP(lookup_value, lookup_range, return_range, [if_not_found], [match_mode])` | Finds lookup_value in lookup_range and returns the item at the same position in return_range. match_mode 0: exact (default), -1: exact or next smaller, 1: exact or next larger. | `=XLOOKUP("Bob", A2:A10, C2:C10, "Not found")` |

## Text

| Function | Description | Example |
| --- | --- | --- |
| `CHAR(number)` | Character for a character code (1–65535). | `=CHAR(65)` |
| `CODE(text)` | Character code of the first character. | `=CODE("A")` |
| `CONCAT(text1, [text2], ...)` | Joins text from values and ranges. | `=CONCAT(A1, " ", B1)` |
| `CONCATENATE(text1, [text2], ...)` | Joins single values together (same as the & operator). | `=CONCATENATE("Q", 3)` |
| `EXACT(text1, text2)` | TRUE if two texts are identical (case-sensitive). | `=EXACT("abc", "ABC")` |
| `FIND(find_text, within_text, [start])` | 1-based position of find_text in within_text (case-sensitive). | `=FIND("a", "banana")` |
| `LEFT(text, [num_chars])` | First characters of the text (default 1). | `=LEFT("Spreadsheet", 6)` |
| `LEN(text)` | Number of characters in the text. | `=LEN("hello")` |
| `LOWER(text)` | Converts text to lower case. | `=LOWER("ABC")` |
| `MID(text, start, num_chars)` | Characters from the middle of the text, starting at a 1-based position. | `=MID("Spreadsheet", 7, 5)` |
| `PROPER(text)` | Capitalises the first letter of every word. | `=PROPER("grace hopper")` |
| `REPLACE(old_text, start, num_chars, new_text)` | Replaces num_chars characters starting at a 1-based position. | `=REPLACE("2024-01", 1, 4, "2025")` |
| `REPT(text, times)` | Repeats text a number of times. | `=REPT("★", 3)` |
| `RIGHT(text, [num_chars])` | Last characters of the text (default 1). | `=RIGHT("Spreadsheet", 5)` |
| `SEARCH(find_text, within_text, [start])` | Like FIND, but case-insensitive and supports * and ? wildcards. | `=SEARCH("n?n", "Banana")` |
| `SUBSTITUTE(text, old_text, new_text, [instance])` | Replaces occurrences of old_text (all, or only the n-th instance). | `=SUBSTITUTE("a-b-c", "-", "+")` |
| `TEXT(value, format)` | Formats a number as text. Supports 0, 0.00, #,##0, 0% and literal prefixes/suffixes like "$". | `=TEXT(1234.5, "$#,##0.00")` |
| `TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)` | Joins values and ranges with a delimiter, optionally skipping empty values. | `=TEXTJOIN(", ", TRUE, A1:A5)` |
| `TRIM(text)` | Removes leading/trailing spaces and collapses internal runs of spaces. | `=TRIM("  a   b ")` |
| `UPPER(text)` | Converts text to upper case. | `=UPPER("abc")` |
| `VALUE(text)` | Converts text that looks like a number into a number. | `=VALUE("42.5")` |

## Information

| Function | Description | Example |
| --- | --- | --- |
| `ISBLANK(value)` | TRUE if the value is an empty cell. | `=ISBLANK(A1)` |
| `ISERR(value)` | TRUE if the value is any error except #N/A. | `=ISERR(A1)` |
| `ISERROR(value)` | TRUE if the value is any error. | `=ISERROR(A1/B1)` |
| `ISEVEN(number)` | TRUE if the integer part of the number is even. | `=ISEVEN(4)` |
| `ISLOGICAL(value)` | TRUE if the value is TRUE or FALSE. | `=ISLOGICAL(A1)` |
| `ISNA(value)` | TRUE if the value is #N/A. | `=ISNA(MATCH(5, A1:A9, 0))` |
| `ISNUMBER(value)` | TRUE if the value is a number. | `=ISNUMBER(A1)` |
| `ISODD(number)` | TRUE if the integer part of the number is odd. | `=ISODD(3)` |
| `ISTEXT(value)` | TRUE if the value is text. | `=ISTEXT(A1)` |
| `NA()` | Returns the #N/A error (useful as a "not available" marker). | `=IF(A1="", NA(), A1)` |
| `TYPE(value)` | Type code: 1 number (or blank), 2 text, 4 logical, 16 error, 64 range. | `=TYPE("hi")` |

## Operators

| Operator | Meaning | Precedence (high → low) |
| --- | --- | --- |
| `%` | Percent (postfix): `50%` = 0.5 | 1 |
| `-` `+` (unary) | Negation | 2 |
| `^` | Exponent (`-2^2` = 4, left-associative) | 3 |
| `*` `/` | Multiply, divide | 4 |
| `+` `-` | Add, subtract | 5 |
| `&` | Text concatenation | 6 |
| `=` `<>` `<` `>` `<=` `>=` | Comparison (text is case-insensitive) | 7 |

## Error values

| Error | Meaning |
| --- | --- |
| `#DIV/0!` | Division by zero |
| `#VALUE!` | Wrong type of value (e.g. text used in arithmetic, a range where one value is expected) |
| `#REF!` | Invalid reference (outside the sheet, or index outside a range) |
| `#NAME?` | Unknown function or name |
| `#N/A` | Value not found (lookups) |
| `#NUM!` | Invalid numeric result (e.g. `SQRT(-1)`) |
| `#CIRC!` | Circular reference |
| `#ERROR!` | Formula syntax error |
