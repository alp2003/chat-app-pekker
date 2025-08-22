# AI Development Guardrails

This document establishes strict rules for AI-assisted development to ensure code quality, stability, and maintainability.

## Core Principles

### 🚫 API Contract Protection
- **No public API contract changes** (OpenAPI/DTO/zod schemas) unless explicitly requested
- Preserve backward compatibility at all costs
- Document any unavoidable breaking changes with migration guides

### 🚫 Database Schema Stability
- **No DB schema changes** in feature PRs - migrations go in separate PRs
- Schema changes require explicit approval and planning
- Always provide rollback migrations

### 🚫 Behavior Preservation
- **No behavior changes** outside clearly marked refactors with comprehensive tests
- Existing functionality must remain unchanged unless explicitly requested
- Document all behavior modifications with before/after examples

## Code Change Guidelines

### ✅ Minimal Diff Policy
- **Only diff/patch output** - never whole-file rewrites unless explicitly asked
- Focus on surgical changes to specific functions/methods
- Preserve existing code structure and patterns

### 🛡️ Risk Management
- **Keep changes behind feature flags** where risk exists
- Use environment variables for experimental features
- Implement graceful fallbacks for new functionality

### 🧪 Testing Requirements
- **Add/adjust tests** for every non-trivial refactor
- Maintain or improve test coverage
- Include both unit and integration tests for complex changes

## Development Workflow

### Before Making Changes
1. Analyze existing code patterns and conventions
2. Identify potential breaking changes or side effects
3. Plan minimal, targeted modifications
4. Consider feature flag strategy for risky changes

### During Development
1. Make smallest possible changes to achieve the goal
2. Preserve existing error handling and edge cases
3. Maintain consistent naming and style patterns
4. Add comprehensive test coverage

### After Changes
1. Verify no regression in existing functionality
2. Document any new behaviors or APIs
3. Update relevant tests and documentation
4. Consider deployment strategy and rollback plan

## Enforcement

These rules are enforced through:
- Code review requirements
- Automated testing pipelines
- CI/CD quality gates
- Documentation requirements

**Violations of these guardrails require explicit justification and approval.**

---

*This document serves as a contract between human developers and AI assistants to maintain code quality and system stability.*
