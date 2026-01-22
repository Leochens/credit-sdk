# Contributing to Credit SDK

Thank you for your interest in contributing to Credit SDK! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Git
- A code editor (VS Code recommended)
- Basic knowledge of TypeScript

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/Leochens/credit-sdk.git
cd credit-sdk
```

3. Add upstream remote:

```bash
git remote add upstream https://github.com/Leochens/credit-sdk.git
```

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### 4. Commit Your Changes

We use conventional commits:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in charge operation"
git commit -m "docs: update API documentation"
git commit -m "test: add tests for refund operation"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide type annotations for public APIs
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes
- Use type aliases for unions and complex types

**Example:**

```typescript
// ✅ Good
interface User {
  id: string;
  credits: number;
  membershipTier: string | null;
}

async function getUserById(userId: string): Promise<User | null> {
  // Implementation
}

// ❌ Bad
async function getUserById(userId: any): Promise<any> {
  // Implementation
}
```

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at end of statements
- Use trailing commas in multi-line objects/arrays
- Maximum line length: 100 characters

**Example:**

```typescript
// ✅ Good
const config = {
  costs: {
    'generate-post': { default: 10, premium: 8 },
    'generate-image': { default: 20, premium: 15 },
  },
};

// ❌ Bad
const config = {
  costs: {
    "generate-post": {default: 10, premium: 8},
    "generate-image": {default: 20, premium: 15}
  }
}
```

### Naming Conventions

- **Classes**: PascalCase (`CreditsEngine`, `PrismaAdapter`)
- **Interfaces**: PascalCase with `I` prefix for adapters (`IStorageAdapter`, `ILogAdapter`)
- **Functions**: camelCase (`charge`, `queryBalance`)
- **Variables**: camelCase (`userId`, `balanceAfter`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TTL`)
- **Files**: camelCase for code, kebab-case for docs (`CreditsEngine.ts`, `api-reference.md`)

### Documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions
- Include return type descriptions
- Include examples for complex functions
- Document thrown errors

**Example:**

```typescript
/**
 * Charge credits from a user's balance
 * 
 * @param params - Charge parameters
 * @param params.userId - User ID
 * @param params.action - Action name
 * @param params.idempotencyKey - Optional idempotency key
 * @param params.metadata - Optional metadata
 * @param params.txn - Optional transaction context
 * @returns Charge result with transaction details
 * @throws {InsufficientCreditsError} When user has insufficient credits
 * @throws {UserNotFoundError} When user does not exist
 * 
 * @example
 * ```typescript
 * const result = await engine.charge({
 *   userId: 'user-123',
 *   action: 'generate-post',
 *   idempotencyKey: 'unique-key'
 * });
 * ```
 */
async charge(params: ChargeParams): Promise<ChargeResult> {
  // Implementation
}
```

### Error Handling

- Use custom error classes
- Provide meaningful error messages
- Include relevant context in errors
- Don't swallow errors silently

**Example:**

```typescript
// ✅ Good
if (user.credits < cost) {
  throw new InsufficientCreditsError(
    userId,
    cost,
    user.credits
  );
}

// ❌ Bad
if (user.credits < cost) {
  throw new Error('Not enough credits');
}
```

## Testing Requirements

### Test Coverage

- Minimum 90% code coverage for core logic
- 100% coverage for critical paths (charge, refund, grant)
- Test both success and failure scenarios
- Test edge cases

### Test Types

#### 1. Unit Tests

Test individual functions and classes in isolation.

```typescript
describe('CostFormula', () => {
  it('should calculate cost for default tier', () => {
    const cost = formula.calculate('generate-post', null);
    expect(cost).toBe(10);
  });

  it('should apply membership discount', () => {
    const cost = formula.calculate('generate-post', 'premium');
    expect(cost).toBe(8);
  });
});
```

#### 2. Integration Tests

Test interactions between components.

```typescript
describe('CreditsEngine Integration', () => {
  it('should charge credits and create transaction', async () => {
    const result = await engine.charge({
      userId: 'user-123',
      action: 'generate-post'
    });

    const transactions = await engine.getHistory('user-123');
    expect(transactions).toHaveLength(1);
  });
});
```

#### 3. Property-Based Tests

Test universal properties across many inputs.

```typescript
import fc from 'fast-check';

it('should never allow negative balance', () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        balance: fc.nat(1000),
        cost: fc.nat(2000)
      }),
      async ({ balance, cost }) => {
        if (cost > balance) {
          await expect(
            engine.charge({ userId, action })
          ).rejects.toThrow(InsufficientCreditsError);
        }
      }
    )
  );
});
```

### Test Organization

```
tests/
├── unit/
│   ├── CreditsEngine.test.ts
│   ├── CostFormula.test.ts
│   └── MembershipValidator.test.ts
├── integration/
│   ├── PrismaAdapter.integration.test.ts
│   └── MockAdapter.integration.test.ts
└── fixtures/
    └── testData.ts
```

## Pull Request Process

### Before Submitting

1. **Update documentation** if you changed APIs
2. **Add tests** for new features
3. **Run all tests** and ensure they pass
4. **Run linter** and fix any issues
5. **Update CHANGELOG.md** with your changes
6. **Rebase on latest main** to avoid conflicts

```bash
git fetch upstream
git rebase upstream/main
```

### PR Title

Use conventional commit format:

```
feat: add support for MongoDB adapter
fix: resolve race condition in idempotency check
docs: update integration examples
```

### PR Description

Include:

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does it work?
4. **Testing** - How was it tested?
5. **Screenshots** - If applicable

**Template:**

```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

### Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge your PR

### After Merge

1. Delete your feature branch
2. Pull latest changes from main
3. Celebrate! 🎉

## Release Process

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Push to npm
5. Create GitHub release

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Join our Discord community (if available)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Credit SDK! 🙏
