#!/usr/bin/env python3
"""
Quill — Template Renderer
Tokenizer + recursive descent parser. No eval, no exec, no compile.
"""

import sys
import json
import argparse

# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------

TOKEN_TEXT = "TEXT"
TOKEN_EXPR_OPEN = "EXPR_OPEN"    # {{
TOKEN_EXPR_CLOSE = "EXPR_CLOSE"  # }}
TOKEN_TAG_OPEN = "TAG_OPEN"      # {%
TOKEN_TAG_CLOSE = "TAG_CLOSE"    # %}
TOKEN_CONTENT = "CONTENT"        # text inside {{ }} or {% %}


class Token:
    __slots__ = ("type", "value", "line")

    def __init__(self, type_, value, line):
        self.type = type_
        self.value = value
        self.line = line

    def __repr__(self):
        return f"Token({self.type!r}, {self.value!r}, line={self.line})"


class LexError(Exception):
    def __init__(self, message, line):
        super().__init__(message)
        self.line = line


def _scan_expr_content(text, i, n, start_line):
    """
    Scan inside {{ ... }} respecting quoted strings so that }} inside
    a string literal does NOT end the expression.
    Returns (content_str, new_i_after_closing_}}) and updates line count.
    Raises LexError on unclosed {{ or unclosed string.
    """
    line = start_line
    buf = []
    while i < n:
        ch = text[i]
        if ch == '\n':
            line += 1
            buf.append(ch)
            i += 1
        elif ch == '"':
            # Consume a double-quoted string literal
            buf.append(ch)
            i += 1
            while i < n:
                c2 = text[i]
                if c2 == '"':
                    buf.append(c2)
                    i += 1
                    break
                elif c2 == '\\' and i + 1 < n:
                    buf.append(c2)
                    buf.append(text[i + 1])
                    i += 2
                elif c2 == '\n':
                    line += 1
                    buf.append(c2)
                    i += 1
                else:
                    buf.append(c2)
                    i += 1
            else:
                raise LexError(f"Unclosed string literal in expression at line {start_line}", start_line)
        elif ch == '}' and i + 1 < n and text[i + 1] == '}':
            # Closing }}
            content = "".join(buf).strip()
            return content, i + 2, line
        else:
            buf.append(ch)
            i += 1
    raise LexError(f"Unclosed '{{{{' at line {start_line}", start_line)


def tokenize(text):
    """
    Scan template text and emit a list of Tokens.
    Handles {{ }}, {% %}, and plain text.
    """
    tokens = []
    i = 0
    n = len(text)
    line = 1

    while i < n:
        # Look for {{ or {%
        if text[i] == '{' and i + 1 < n:
            next_ch = text[i + 1]
            if next_ch == '{':
                # EXPR_OPEN
                open_line = line
                tokens.append(Token(TOKEN_EXPR_OPEN, "{{", line))
                i += 2
                content, i, line = _scan_expr_content(text, i, n, open_line)
                tokens.append(Token(TOKEN_CONTENT, content, open_line))
                tokens.append(Token(TOKEN_EXPR_CLOSE, "}}", line))
                continue

            elif next_ch == '%':
                # TAG_OPEN
                open_line = line
                tokens.append(Token(TOKEN_TAG_OPEN, "{%", line))
                i += 2
                start = i
                content_line = line
                while i < n:
                    if text[i] == '\n':
                        line += 1
                    if text[i] == '%' and i + 1 < n and text[i + 1] == '}':
                        break
                    i += 1
                else:
                    raise LexError(f"Unclosed '{{%' at line {content_line}", content_line)
                inner = text[start:i].strip()
                tokens.append(Token(TOKEN_CONTENT, inner, content_line))
                tokens.append(Token(TOKEN_TAG_CLOSE, "%}", line))
                i += 2
                # Whitespace control: trim the trailing newline of the tag line
                if i < n and text[i] == '\n':
                    i += 1
                    line += 1
                continue

        # Plain text character — collect until next { or end
        start = i
        while i < n:
            if text[i] == '{' and i + 1 < n and text[i + 1] in ('{', '%'):
                break
            if text[i] == '\n':
                line += 1
            i += 1
        if i > start:
            tokens.append(Token(TOKEN_TEXT, text[start:i], line))

    return tokens


# ---------------------------------------------------------------------------
# AST Nodes
# ---------------------------------------------------------------------------

class TextNode:
    def __init__(self, text, line):
        self.text = text
        self.line = line


class ExprNode:
    def __init__(self, path, line, _literal=None):
        """
        path: list of strings e.g. ['a', 'b', 'c'] for a.b.c, or None if literal
        _literal: if not None, render this string directly (escape sequences)
        """
        self.path = path
        self.line = line
        self._literal = _literal


class ForNode:
    def __init__(self, var, iterable_path, body, line):
        self.var = var
        self.iterable_path = iterable_path  # list of strings
        self.body = body  # list of AST nodes
        self.line = line


class IfNode:
    def __init__(self, cond_path, body, line):
        self.cond_path = cond_path  # list of strings
        self.body = body  # list of AST nodes
        self.line = line


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

class ParseError(Exception):
    def __init__(self, message, line):
        super().__init__(message)
        self.line = line


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def consume(self):
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def parse(self):
        return self._parse_nodes(end_tag=None)

    def _parse_nodes(self, end_tag):
        """Parse nodes until end_tag is found (consuming it), or until end of tokens."""
        nodes = []
        while self.pos < len(self.tokens):
            tok = self.peek()
            if tok is None:
                break
            if tok.type == TOKEN_TEXT:
                self.consume()
                nodes.append(TextNode(tok.value, tok.line))
            elif tok.type == TOKEN_EXPR_OPEN:
                node = self._parse_expr()
                nodes.append(node)
            elif tok.type == TOKEN_TAG_OPEN:
                # Peek content
                content_tok = self.tokens[self.pos + 1] if self.pos + 1 < len(self.tokens) else None
                if content_tok is None or content_tok.type != TOKEN_CONTENT:
                    raise ParseError("Malformed tag", tok.line)
                content = content_tok.value

                if end_tag and content == end_tag:
                    # Consume the end tag
                    self.consume()  # TAG_OPEN
                    self.consume()  # CONTENT
                    self.consume()  # TAG_CLOSE
                    return nodes

                if content.startswith("for "):
                    node = self._parse_for()
                    nodes.append(node)
                elif content.startswith("if "):
                    node = self._parse_if()
                    nodes.append(node)
                elif content in ("endfor", "endif"):
                    # If we hit an unexpected end tag while not looking for it,
                    # stop (let caller handle mismatch)
                    break
                else:
                    raise ParseError(f"Unknown tag: {content!r}", content_tok.line)
            else:
                break

        if end_tag is not None:
            raise ParseError(f"Missing {{%% {end_tag} %%}}", 0)
        return nodes

    def _parse_expr(self):
        open_tok = self.consume()   # EXPR_OPEN
        content_tok = self.consume()  # CONTENT
        close_tok = self.consume()  # EXPR_CLOSE
        inner = content_tok.value

        # Handle escape: string literals like "{{" or "}}"
        if inner.startswith('"') and inner.endswith('"') and len(inner) >= 2:
            literal = inner[1:-1]
            return ExprNode(None, content_tok.line, _literal=literal)

        # Dotted path
        path = [p.strip() for p in inner.split(".") if p.strip()]
        if not path:
            raise ParseError(f"Empty expression at line {content_tok.line}", content_tok.line)
        return ExprNode(path, content_tok.line)

    def _parse_for(self):
        """{% for var in iterable %}...{% endfor %}"""
        self.consume()              # TAG_OPEN
        content_tok = self.consume()  # CONTENT: "for x in list"
        self.consume()              # TAG_CLOSE
        line = content_tok.line

        parts = content_tok.value.split()
        if len(parts) != 4 or parts[0] != "for" or parts[2] != "in":
            raise ParseError(f"Invalid for tag: {content_tok.value!r}", line)
        var_name = parts[1]
        iterable_str = parts[3]
        iterable_path = [p.strip() for p in iterable_str.split(".") if p.strip()]

        body = self._parse_nodes("endfor")
        return ForNode(var_name, iterable_path, body, line)

    def _parse_if(self):
        """{% if cond %}...{% endif %}"""
        self.consume()              # TAG_OPEN
        content_tok = self.consume()  # CONTENT: "if cond"
        self.consume()              # TAG_CLOSE
        line = content_tok.line

        parts = content_tok.value.split()
        if len(parts) != 2 or parts[0] != "if":
            raise ParseError(f"Invalid if tag: {content_tok.value!r}", line)
        cond_str = parts[1]
        cond_path = [p.strip() for p in cond_str.split(".") if p.strip()]

        body = self._parse_nodes("endif")
        return IfNode(cond_path, body, line)


# ---------------------------------------------------------------------------
# Custom truthiness
# ---------------------------------------------------------------------------

def is_truthy(val):
    """Custom truthiness per spec — NOT Python's bool()."""
    if val is False or val is None:
        return False
    if isinstance(val, bool):
        return True  # True is truthy
    if isinstance(val, int) and val == 0:
        return False  # only int zero is falsy, not float zero
    if isinstance(val, (str, list, dict)) and len(val) == 0:
        return False
    return True


# ---------------------------------------------------------------------------
# Renderer
# ---------------------------------------------------------------------------

class UndefinedError(Exception):
    def __init__(self, name, line):
        super().__init__(f"Undefined: {name} at line {line}")
        self.name = name
        self.line = line


def resolve_path(path, context, line, lenient=False):
    """Resolve a dotted path list against context dict."""
    val = context
    for key in path:
        if isinstance(val, dict) and key in val:
            val = val[key]
        else:
            if lenient:
                return ""
            raise UndefinedError(".".join(path), line)
    return val


def render_nodes(nodes, context, lenient=False):
    """Render a list of AST nodes to a string. May raise UndefinedError."""
    parts = []
    for node in nodes:
        if isinstance(node, TextNode):
            parts.append(node.text)
        elif isinstance(node, ExprNode):
            if node._literal is not None:
                parts.append(node._literal)
            else:
                val = resolve_path(node.path, context, node.line, lenient=lenient)
                parts.append(str(val))
        elif isinstance(node, ForNode):
            iterable = resolve_path(node.iterable_path, context, node.line, lenient=lenient)
            if not isinstance(iterable, (list, tuple)):
                iterable = [iterable]
            for item in iterable:
                # Create child context with loop var, keeping parent vars
                child_ctx = dict(context)
                child_ctx[node.var] = item
                parts.append(render_nodes(node.body, child_ctx, lenient=lenient))
        elif isinstance(node, IfNode):
            val = resolve_path(node.cond_path, context, node.line, lenient=lenient)
            if is_truthy(val):
                parts.append(render_nodes(node.body, context, lenient=lenient))
    return "".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Quill template renderer")
    parser.add_argument("command", choices=["render"], help="Command")
    parser.add_argument("--lenient", action="store_true", help="Lenient mode: undefined vars = empty string")
    parser.add_argument("template", help="Template file path")
    parser.add_argument("context", help="JSON context file path")
    args = parser.parse_args()

    # Read template
    try:
        with open(args.template, "rb") as f:
            raw = f.read()
        try:
            template_text = raw.decode("utf-8")
        except UnicodeDecodeError:
            sys.stderr.write("Error: non-UTF-8 input\n")
            sys.exit(8)
    except FileNotFoundError:
        sys.stderr.write(f"Error: template file not found: {args.template}\n")
        sys.exit(1)

    # Read context JSON
    try:
        with open(args.context, "rb") as f:
            raw_ctx = f.read()
        try:
            ctx_text = raw_ctx.decode("utf-8")
        except UnicodeDecodeError:
            sys.stderr.write("Error: non-UTF-8 context\n")
            sys.exit(8)
        context = json.loads(ctx_text)
    except FileNotFoundError:
        sys.stderr.write(f"Error: context file not found: {args.context}\n")
        sys.exit(1)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Error: invalid JSON context: {e}\n")
        sys.exit(1)

    # Tokenize
    try:
        tokens = tokenize(template_text)
    except LexError as e:
        sys.stderr.write(f"Parse error: {e} (line {e.line})\n")
        sys.exit(6)

    # Parse
    try:
        p = Parser(tokens)
        ast = p.parse()
    except ParseError as e:
        sys.stderr.write(f"Parse error: {e} (line {e.line})\n")
        sys.exit(6)

    # Render — buffer all output
    try:
        output = render_nodes(ast, context, lenient=args.lenient)
    except UndefinedError as e:
        sys.stderr.write(f"Undefined: {e.name} at line {e.line}\n")
        sys.exit(7)

    # Only flush to stdout on success
    sys.stdout.write(output)
    sys.exit(0)


if __name__ == "__main__":
    main()
