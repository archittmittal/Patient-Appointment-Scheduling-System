# 🤝 Contributing to HealthSync Premium

Thank you for your interest in contributing to HealthSync Premium! We're excited to have you join our community. This guide will help you understand how to contribute effectively.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Issue Labels & Difficulty](#issue-labels--difficulty)
- [Pull Request Process](#pull-request-process)
- [Code Style Guide](#code-style-guide)
- [Testing Guidelines](#testing-guidelines)
- [Commit Conventions](#commit-conventions)
- [Review Process](#review-process)
- [Getting Help](#getting-help)

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We pledge to make participation in our community a harassment-free experience for everyone.

### Expected Behavior

✅ **DO:**
- Be respectful and professional in all interactions
- Welcome new contributors and help them succeed
- Focus on what's best for the community
- Show empathy towards other community members
- Give credit and acknowledgment to others' ideas

❌ **DON'T:**
- Use harassing or discriminatory language
- Engage in personal attacks or trolling
- Share others' private information without consent
- Spam or promote unrelated products/services
- Violate healthcare privacy regulations (HIPAA in US)

### Enforcement

Violations of this code of conduct may result in:
- Warning
- Temporary ban from repository
- Permanent removal from community

Report violations to: [archit@healthsync.dev](mailto:archit@healthsync.dev)

---

## 🚀 Getting Started

### Prerequisites

Before you start, ensure you have:

```bash
# Required
- Node.js >= 16.0.0
- npm >= 8.0.0 or yarn
- Git
- GitHub account

# Optional but recommended
- VS Code + ESLint extension
- Postman or Insomnia (for API testing)
- DBeaver (for database exploration)
- GitHub CLI (gh)
```

### Fork and Clone

```bash
# 1. Fork the repository on GitHub
# Click "Fork" button at https://github.com/archittmittal/Patient-Appointment-Scheduling-System

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/Patient-Appointment-Scheduling-System.git
cd Patient-Appointment-Scheduling-System

# 3. Add upstream remote for sync
git remote add upstream https://github.com/archittmittal/Patient-Appointment-Scheduling-System.git

# 4. Verify remotes
git remote -v
# origin    https://github.com/YOUR_USERNAME/...  (your fork)
# upstream  https://github.com/archittmittal/...   (original)
```

### Initial Setup

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Setup environment
cp .env.example .env

# 3. Update .env with your local settings
# (Database URL, JWT secret, API keys, etc.)
nano .env

# 4. Setup database
npm run db:migrate
npm run db:seed

# 5. Verify installation
npm run dev          # Backend
# In another terminal:
cd frontend && npm run dev  # Frontend
```

---

## 👨‍💻 Development Workflow

### Step 1: Find an Issue

```bash
# Browse open issues
# https://github.com/archittmittal/Patient-Appointment-Scheduling-System/issues

# Filter by difficulty
- "good first issue"  ← Start here if new
- "help wanted"
- "bug"
- "feature"

# Filter by component
- "backend"
- "frontend"
- "database"
- "devops"
```

**Recommended first contributions:**
1. Issue #136 - Fix DoctorAnalytics typo (1h)
2. Issue #138 - Fix N+1 queries (2-3h)
3. Documentation improvements (30min-1h)

### Step 2: Create a Branch

```bash
# Update your local main branch
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feat/issue-127-rate-limiting

# Naming convention:
# - feat/issue-XXX-feature-name       (new feature)
# - fix/issue-XXX-bug-description     (bug fix)
# - docs/issue-XXX-doc-update         (documentation)
# - refactor/issue-XXX-module-name    (refactoring)
# - test/issue-XXX-test-suite-name    (test addition)
```

### Step 3: Make Changes

```bash
# Edit files and implement your feature
# Follow code style guide (see below)
# Add tests for your changes (see testing guidelines)
# Run tests locally

npm test                    # Backend tests
cd frontend && npm test     # Frontend tests
npm run lint               # Check code style
```

### Step 4: Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with conventional message
git commit -m "feat: add rate limiting to auth endpoints (#127)"

# Commit message format:
# <type>(<scope>): <subject> (#issue)
#
# <body>
#
# <footer>
```

**Commit message examples:**
```
feat(auth): add rate limiting to login endpoint (#127)

Added express-rate-limit middleware to prevent brute force attacks.
- Configured 10 requests/15min for /auth/login
- Added X-RateLimit-* headers to responses
- Implemented exponential backoff

Fixes #127
Relates to #128, #131
```

### Step 5: Push and Create Pull Request

```bash
# Push to your fork
git push origin feat/issue-127-rate-limiting

# Create PR on GitHub
# - Go to your fork
# - Click "Compare & pull request"
# - Fill in the PR template
# - Submit

# OR use GitHub CLI
gh pr create --title "feat: add rate limiting (#127)" \
             --body "Description here" \
             --base archittmittal:main \
             --head YOUR_USERNAME:feat/issue-127-rate-limiting
```

---

## 🏷️ Issue Labels & Difficulty

### By Component

| Label | Description | When to Use |
|-------|-------------|-----------|
| `backend` | Node.js/Express server | API routes, services, middleware |
| `frontend` | React/Vite application | Pages, components, hooks, styling |
| `database` | TiDB/MySQL schema, migrations | Schema changes, queries, migrations |
| `devops` | Docker, CI/CD, deployment | Docker setup, GitHub Actions, configs |

### By Type

| Label | Icon | Description |
|-------|------|-------------|
| `bug` | 🐛 | Something isn't working correctly |
| `feature` | ✨ | New functionality to add |
| `enhancement` | 🚀 | Improvement to existing feature |
| `documentation` | 📚 | Docs, comments, guides |
| `performance` | ⚡ | Speed optimization |
| `security` | 🔒 | Security vulnerabilities or hardening |
| `testing` | 🧪 | Test coverage and quality |

### By Priority

| Label | Color | Timeline | Effort |
|-------|-------|----------|--------|
| `priority:critical` | 🔴 | ASAP | 3-4 days |
| `priority:high` | 🟠 | This week | 2-3 days |
| `priority:medium` | 🟡 | Next week | 1-2 days |
| `priority:low` | 🟢 | Backlog | <1 day |

### By Week (Roadmap)

| Label | Color | Focus Area | When |
|-------|-------|-----------|------|
| `week:week-1` | 🔵 Blue | Security | Week 1 |
| `week:week-2` | 🟣 Purple | Testing | Week 2 |
| `week:week-3` | 🌸 Pink | Architecture | Week 3 |
| `week:week-4` | 🔷 Cyan | Features | Week 4+ |

**Difficulty Labels for Beginners:**

```
⭐ Good First Issue
  └─ Pick one of these if you're new to the project
  └─ Estimated: 30min - 2 hours
  └─ Examples: Typo fixes, small documentation updates

⭐⭐ Help Wanted
  └─ Open to community, guidance provided
  └─ Estimated: 2-8 hours
  └─ Examples: Bug fixes, feature implementation

⭐⭐⭐ Complex Issues
  └─ Requires deep understanding of codebase
  └─ Estimated: 8-20+ hours
  └─ Examples: Major refactors, new architecture
```

---

## 🔄 Pull Request Process

### PR Title Format

```
<type>(<scope>): <subject> (#issue)

Examples:
- feat(auth): add rate limiting middleware (#127)
- fix(queue): resolve N+1 query in admin users list (#138)
- docs(readme): add deployment instructions
- test(appointments): add booking flow tests (#132)
```

### PR Description Template

```markdown
## Description
Brief explanation of what this PR does.

## Related Issues
Fixes #XXX
Relates to #YYY, #ZZZ

## Changes
- Change 1
- Change 2
- Change 3

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix/feature causing existing functionality to break)
- [ ] Documentation update

## Testing
Describe the tests you ran and how to reproduce them:
```bash
npm test -- --testNamePattern="rate limiting"
```

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Screenshots (if applicable)
[Add screenshots of UI changes]

## Checklist
- [ ] My code follows the code style guide
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged and published

## Breaking Changes
None

## Additional Context
Any additional information about your PR.
```

### PR Review Checklist

**Reviewers will check:**

- ✅ Code follows style guide
- ✅ All tests pass
- ✅ No console.log() or debug code
- ✅ No commented-out code
- ✅ Functions are documented
- ✅ Variable names are clear
- ✅ No security vulnerabilities
- ✅ Performance is acceptable
- ✅ Error handling is complete
- ✅ Backwards compatibility maintained

---

## 📝 Code Style Guide

### JavaScript/Node.js

```javascript
// ✅ GOOD - Clear, well-documented
const calculateQueueWaitTime = async (appointmentId, doctorSchedule) => {
  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError(`Appointment ${appointmentId} not found`);
    }

    const waitTime = predictWaitTime(appointment, doctorSchedule);
    logger.info(`Calculated wait time for appointment ${appointmentId}`, { waitTime });
    
    return {
      waitTime,
      confidence: 0.95,
      updatedAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to calculate queue wait time', { error, appointmentId });
    throw new InternalError('Wait time calculation failed');
  }
};

// ❌ BAD - Unclear, no error handling
function calc(id){
  let x = Appointment.findById(id);
  let y = predict(x);
  return y;
}
```

### Key Principles

```javascript
// 1. Use async/await (not callbacks)
const result = await dbQuery();  // ✅
const result = dbQuery(callback);  // ❌

// 2. Use descriptive names
const calculateSmartArrivalTime = () => {};  // ✅
const calc() => {};  // ❌

// 3. Use const by default, let if needed
const user = getUserData();  // ✅
var user = getUserData();  // ❌

// 4. Add comments for complex logic
// Predict wait time using weighted average of recent appointments
// Weights: recent (0.6) > historical (0.4) to adapt to schedule changes
const waitTime = recent * 0.6 + historical * 0.4;  // ✅

// 5. Handle all error cases
try {
  const data = await fetchData();
  if (!data) throw new Error('No data returned');
  return data;
} catch (error) {
  logger.error('Failed to fetch data', error);
  throw new CustomError('Data fetch failed', 500);
}  // ✅

// 6. Return consistent data structures
return {
  success: true,
  data: { /* data */ },
  error: null,
};  // ✅
```

### React/Frontend

```javascript
// ✅ GOOD - Functional component with hooks
const QueueStatusComponent = ({ appointmentId }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getQueueStatus(appointmentId);
        setStatus(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [appointmentId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <div className="queue-status">{status.position}</div>;
};

// ❌ BAD - Class component, no error handling
class Queue extends React.Component {
  componentDidMount() {
    this.setState({ status: getQueueStatus(this.props.id) });
  }

  render() {
    return <div>{this.state.status}</div>;
  }
}
```

### ESLint Configuration

The project uses ESLint with these rules:

```javascript
// .eslintrc.js
module.exports = {
  extends: ['airbnb', 'prettier'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
```

**Run linter:**
```bash
npm run lint           # Check style
npm run lint:fix      # Auto-fix style issues
```

---

## 🧪 Testing Guidelines

### Test Coverage Requirements

| Module | Minimum | Target |
|--------|---------|--------|
| **Critical** (Auth, Payments) | 80% | 95%+ |
| **Core** (Appointments, Queue) | 60% | 85%+ |
| **Feature** (Analytics, UI) | 40% | 70%+ |
| **Overall** | 50% | 80%+ |

### Backend Testing (Jest + Supertest)

```javascript
// ✅ GOOD - Clear test structure
describe('Appointment Service', () => {
  beforeEach(() => {
    // Setup
    jest.clearAllMocks();
  });

  describe('bookAppointment', () => {
    it('should successfully book appointment with valid data', async () => {
      // Arrange
      const appointment = {
        patientId: '123',
        doctorId: '456',
        date: '2024-05-01',
      };

      // Act
      const result = await appointmentService.bookAppointment(appointment);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error if doctor is unavailable', async () => {
      // Arrange
      const appointment = { doctorId: 'invalid' };

      // Act & Assert
      await expect(
        appointmentService.bookAppointment(appointment)
      ).rejects.toThrow('Doctor not available');
    });
  });
});
```

### Frontend Testing (React Testing Library)

```javascript
// ✅ GOOD - User-focused tests
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('QueueStatusComponent', () => {
  it('should display queue position when data loads', async () => {
    // Arrange
    render(<QueueStatusComponent appointmentId="123" />);
    
    // Act
    await waitFor(() => {
      expect(screen.getByText(/Queue Position: 5/i)).toBeInTheDocument();
    });

    // Assert
    expect(screen.getByRole('button', { name: /check status/i })).toBeEnabled();
  });

  it('should allow user to cancel appointment', async () => {
    const user = userEvent.setup();
    render(<QueueStatusComponent appointmentId="123" />);

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(screen.getByText(/appointment cancelled/i)).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
# Backend
npm test                           # Run all tests
npm test -- --watch                # Watch mode
npm test -- --coverage             # With coverage report
npm test -- --testNamePattern="auth"  # Specific test

# Frontend
cd frontend
npm test -- --coverage             # Run with coverage
npm test -- --watch                # Watch mode
```

### Test File Naming

```
src/
├── services/
│   ├── appointmentService.js
│   └── __tests__/
│       └── appointmentService.test.js
├── routes/
│   ├── appointments.js
│   └── __tests__/
│       └── appointments.integration.test.js
```

---

## 📤 Commit Conventions

### Conventional Commits Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Use Case | Example |
|------|----------|---------|
| `feat` | New feature | feat(auth): add OTP support |
| `fix` | Bug fix | fix(queue): resolve N+1 query |
| `docs` | Documentation | docs(readme): add setup guide |
| `style` | Formatting, missing semicolons | style(auth): fix indentation |
| `refactor` | Code refactoring (no behavior change) | refactor(queue): extract util functions |
| `perf` | Performance improvements | perf(db): add database indexes |
| `test` | Adding or updating tests | test(auth): add login flow tests |
| `chore` | Build, dependencies, CI/CD | chore(deps): upgrade express |

### Commit Examples

```bash
# Feature commit
git commit -m "feat(auth): implement rate limiting middleware

- Added express-rate-limit to login endpoint
- Configured 10 requests per 15 minutes
- Added X-RateLimit-* headers to responses
- Added unit tests for rate limiter

Fixes #127"

# Bug fix commit
git commit -m "fix(queue): resolve N+1 query in admin users list

The admin dashboard was making one query per user instead of
joining in a single query. This caused 30+ second load times
with 1000 users.

Changed from multiple findById() calls to single JOIN query.
Load time reduced from 35s to 200ms.

Fixes #138
Related to #141"

# Documentation commit
git commit -m "docs(api): add Swagger documentation for auth endpoints

Added OpenAPI/Swagger specs for:
- POST /auth/register
- POST /auth/login
- POST /auth/forgot-password
- POST /auth/reset-password

All endpoints include request/response examples and error codes."
```

---

## 🔍 Review Process

### What Happens After You Submit a PR

1. **Automated Checks** (2-5 min)
   - CI/CD pipeline runs
   - Tests must pass ✅
   - Code style checks (linting)
   - Coverage analysis

2. **Manual Review** (24-48 hours)
   - Code owner reviews code
   - Checks for:
     - Correctness
     - Security issues
     - Performance impact
     - Documentation
   - May request changes

3. **Requested Changes** (if needed)
   - Update your code based on feedback
   - Push new commits to same branch
   - PR updates automatically
   - Request re-review

4. **Approval & Merge**
   - PR is approved ✅
   - Squash & merge or rebase & merge
   - Branch is deleted
   - Issue is auto-closed (if linked)

### Responding to Review Comments

```markdown
# ✅ Good - Acknowledges feedback
Great catch! I see the issue now. The function wasn't handling 
the edge case where appointmentTime is null. I've added validation 
and a test case in commit abc123.

# ✅ Good - Asks clarifying question
I made the change as suggested. Just to confirm - should this also 
apply to the rescheduling flow, or is this specific to new bookings?

# ❌ Bad - Defensive tone
I don't think that's an issue...

# ❌ Bad - Ignores feedback
I'll leave it as is.
```

### Merge Criteria

PR will be merged when:
- ✅ All CI checks pass
- ✅ At least 1 approval from maintainer
- ✅ No unresolved review threads
- ✅ Branch is up-to-date with main
- ✅ Commit history is clean

---

## 🆘 Getting Help

### Q&A Resources

| Question | Resource |
|----------|----------|
| How do I...? | 📖 [README.md](README.md) |
| API question? | 📡 [Swagger Docs](http://localhost:7860/api-docs) |
| Architecture question? | 📐 [GITHUB_ISSUES_SUMMARY.md](GITHUB_ISSUES_SUMMARY.md) |
| Stuck on issue? | 💬 [GitHub Discussions](https://github.com/archittmittal/Patient-Appointment-Scheduling-System/discussions) |
| Found a bug? | 🐛 [Open Issue](https://github.com/archittmittal/Patient-Appointment-Scheduling-System/issues) |
| Security concern? | 🔒 [Email Maintainer](mailto:archit@healthsync.dev) |

### Community Channels

```bash
# GitHub Issues (Public)
Questions about implementation, feedback on issues
→ https://github.com/archittmittal/Patient-Appointment-Scheduling-System/issues

# GitHub Discussions (Public)
Questions, ideas, showing off contributions
→ https://github.com/archittmittal/Patient-Appointment-Scheduling-System/discussions

# Email (Private)
Security issues, sensitive topics
→ archit@healthsync.dev

# LinkedIn (Public)
Project updates, career opportunities
→ https://linkedin.com/in/architmittal
```

### Common Questions

**Q: How do I find an issue to work on?**  
A: Filter issues by `good first issue` label or choose from [Week 1 issues](#week-1---security-foundation). Start with issues marked as "help wanted" or "documentation".

**Q: Can I work on multiple issues?**  
A: Start with one! Once you're comfortable, you can work on 2-3 if they're independent.

**Q: How long do PRs take to review?**  
A: Usually 24-48 hours. Complex changes may take longer. Check back on your PR regularly.

**Q: What if I'm stuck on a bug?**  
A: Comment on the issue asking for help! Use GitHub Discussions to get feedback from the community.

**Q: Can I create a PR without an issue?**  
A: Better to open an issue first! This ensures your work aligns with the project. Bug fixes without issues are okay.

**Q: How do I update my fork?**  
A: 
```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

**Q: What if my branch has conflicts?**  
A:
```bash
git fetch upstream
git rebase upstream/main
# Resolve conflicts in your editor
git add .
git rebase --continue
git push --force-with-lease origin feat/your-branch
```

---

## 🎖️ Recognition & Rewards

### Contributor Tiers

| Tier | PRs Merged | Recognition |
|------|-----------|-------------|
| 🥉 Bronze | 1-3 | Added to [CONTRIBUTORS.md](CONTRIBUTORS.md) |
| 🥈 Silver | 4-9 | Named in release notes |
| 🥇 Gold | 10+ | Core team consideration |

### Recognition

- ⭐ GitHub badge on your profile
- 📜 Certificate of contribution
- 🎯 Featured in newsletter
- 🤝 Potential team collaboration opportunities

---

## 📚 Useful Resources

### Learning Resources

- [Git Workflow Guide](docs/GIT_WORKFLOW.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [API Design Patterns](docs/API_PATTERNS.md)

### Tools & Extensions

- [VS Code ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [GitHub CLI](https://cli.github.com/)
- [Postman API Client](https://www.postman.com/)

### Related Projects

- [HealthSync Mobile](https://github.com/archittmittal/healthsync-mobile)
- [HealthSync Analytics](https://github.com/archittmittal/healthsync-analytics)

---

## 📝 Development Checklist

Before submitting a PR, ensure:

```bash
# Code Quality
- [ ] Code follows style guide
- [ ] Variables have clear names
- [ ] Complex logic is commented
- [ ] No console.log() left in code
- [ ] No commented-out code sections

# Testing
- [ ] All tests pass locally
- [ ] Added tests for new code
- [ ] Edge cases are covered
- [ ] Error handling is complete

# Documentation
- [ ] Added JSDoc comments
- [ ] Updated README (if needed)
- [ ] Added usage examples
- [ ] Documented any config changes

# Performance
- [ ] No N+1 queries
- [ ] Database indexes verified
- [ ] Bundle size reasonable
- [ ] No memory leaks

# Security
- [ ] No hardcoded secrets
- [ ] Input is validated
- [ ] SQL injection prevention
- [ ] XSS protection considered

# Git
- [ ] Commits are clean and squashed
- [ ] Commit messages follow conventions
- [ ] PR description is clear
- [ ] Related issues are linked
```

---

## 🎉 Thank You!

Thank you for contributing to HealthSync Premium! Your efforts help improve healthcare delivery worldwide. We appreciate your time and dedication to making this project better.

**Welcome to the community! 🚀**

---

**Last Updated:** 28 April 2026  
**Maintained By:** [Archit Mittal](https://github.com/archittmittal)  
**Questions?** Open an issue or start a discussion!
