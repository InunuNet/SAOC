# Coding Standards

Craft rules that hold in every language. Anything specific to one language or
framework belongs in `<project>/.agent/memory/project/rules.md`, not here.

## Write real code
No placeholders, no stubs, no `TODO` standing in for an implementation. If a
piece genuinely cannot be written yet, say so — do not ship a shape that looks
finished.

## Read before you write
Open the file and its neighbours first, then match the idiom already there:
naming, indentation, error handling, comment density. Do not import a personal
style into someone else's codebase.

## Handle the error path
Validate at system boundaries — user input, API responses, file reads. Fail fast
and loudly; never swallow an exception into silence. An error path logs the
operation, its sanitised inputs, and the exception type, and it logs no secrets.

## Leave nothing dead
Remove unused variables, imports, and functions in the same change that orphans
them, and strip debugging output before handing the work over.

## Name the constant
Values that carry meaning get a name, not a literal buried in a loop.
Credentials come from the environment or an encrypted store — a secret in source
makes the commit invalid.

## Verify with code, not with hope
Prefer a check that runs to a claim that reassures: a test, an exit code, a diff.
Human review is the last resort, not the first.
