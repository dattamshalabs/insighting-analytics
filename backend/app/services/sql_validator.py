"""SQL expression validator for glossary terms."""

from __future__ import annotations

import logging
import re
from typing import List, Set

import sqlparse

logger = logging.getLogger(__name__)

# Dangerous SQL patterns that should be blocked
DANGEROUS_PATTERNS = [
    r'\bDROP\b',
    r'\bDELETE\b',
    r'\bINSERT\b',
    r'\bUPDATE\b',
    r'\bTRUNCATE\b',
    r'\bALTER\b',
    r'\bCREATE\b',
    r'\bGRANT\b',
    r'\bREVOKE\b',
    r'\bEXEC\b',
    r'\bEXECUTE\b',
    r'--',  # SQL comments
    r'/\*',  # Block comments
    r'\*/,',
    r';',  # Multiple statements
]


class SQLValidationError(Exception):
    """Raised when SQL validation fails."""
    pass


def validate_sql_expression(sql: str) -> bool:
    """Validate a SQL expression is safe for use in glossary terms.

    Args:
        sql: The SQL expression to validate

    Returns:
        True if valid

    Raises:
        SQLValidationError: If the SQL contains dangerous patterns
    """
    sql_upper = sql.upper()

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, sql_upper, re.IGNORECASE):
            raise SQLValidationError(
                f"SQL expression contains forbidden pattern: {pattern}"
            )

    # Parse the SQL to check for valid syntax
    try:
        parsed = sqlparse.parse(sql)
        if len(parsed) > 1:
            raise SQLValidationError("Multiple SQL statements are not allowed")

        if parsed:
            statement = parsed[0]
            # Check for standalone SELECT statements (not allowed - only expressions)
            tokens = [t for t in statement.tokens if not t.is_whitespace]
            if tokens and tokens[0].ttype is None:
                first_word = str(tokens[0]).upper().strip()
                if first_word == "SELECT":
                    # Allow subqueries in parentheses, but not standalone SELECTs
                    if not sql.strip().startswith("("):
                        raise SQLValidationError(
                            "Standalone SELECT statements are not allowed. "
                            "Use expressions or wrap in parentheses for subqueries."
                        )
    except SQLValidationError:
        raise
    except Exception as e:
        logger.warning("SQL parse warning (non-fatal): %s", e)
        # Don't fail on parse errors - the database will catch invalid SQL

    return True


def extract_dependencies(sql: str, existing_terms: List[str]) -> List[str]:
    """Extract references to other glossary terms in a SQL expression.

    Args:
        sql: The SQL expression to analyze
        existing_terms: List of existing glossary term names

    Returns:
        List of term names that this expression depends on
    """
    dependencies: Set[str] = set()

    # Look for term references in the SQL
    # Terms might be referenced as {{term_name}} or just as identifiers

    # Pattern 1: Explicit template syntax {{term_name}}
    template_matches = re.findall(r'\{\{(\w+)\}\}', sql)
    for match in template_matches:
        if match in existing_terms:
            dependencies.add(match)

    # Pattern 2: Direct term reference (word boundary)
    for term in existing_terms:
        # Check if the term appears as a word in the SQL
        pattern = r'\b' + re.escape(term) + r'\b'
        if re.search(pattern, sql, re.IGNORECASE):
            dependencies.add(term)

    return sorted(list(dependencies))


def expand_term_references(sql: str, term_definitions: dict) -> str:
    """Expand glossary term references in a SQL expression.

    Args:
        sql: The SQL expression with term references
        term_definitions: Dict of term_name -> sql_expression

    Returns:
        Expanded SQL with term references replaced
    """
    result = sql

    # Expand {{term_name}} syntax
    for term_name, definition in term_definitions.items():
        pattern = r'\{\{' + re.escape(term_name) + r'\}\}'
        result = re.sub(pattern, f"({definition})", result, flags=re.IGNORECASE)

    return result
