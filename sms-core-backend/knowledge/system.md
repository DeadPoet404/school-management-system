# Global System Architecture Map

## Core Tech Stack
* **Runtime Environment:** Node.js (v20+ Long-Term Support)
* **Language Compiler:** TypeScript
* **Application Framework:** Express.js (REST API Pattern)
* **Database Engine:** PostgreSQL
* **Object-Relational Mapping:** Prisma ORM

## Project Directory Schema
The system enforces a clean, modular feature-slice framework:
```text
src/
├── app.ts                         # Server bootstrap & global middleware execution
├── lib/
│   └── prisma.ts                  # Shared PrismaClient singleton instance
├── services/
│   └── StudentDepartureService.ts # Specialized cross-cutting student excision engine
└── modules/
    └── students/                  # Isolated feature slice domain
        ├── student.routes.ts      # Domain-specific HTTP entry routing lines
        ├── student.controller.ts  # Input validation & semantic HTTP status handling
        └── student.service.ts     # Core database operations & data mapping pipelines
System Boundaries & Global Guardrails
Lexical Scope Protection: All controller actions must use explicit arrow function properties (methodName = async (req, res) => {}). Traditional class methods drop execution context when assigned directly to Express routers, causing TypeError runtime drops.

Single Responsibility Layering: Cross-cutting lifecycle state changes (like processing an exit and generating an audit trail) must live in dedicated domain services (StudentDepartureService) rather than standard CRUD services.
