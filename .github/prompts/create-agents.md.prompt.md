---
description: Generates an AGENTS.md file for a project repository
---

# Create high‑quality AGENTS.md file

- **Input**: Any files that may provide context about the project, including but not limited to README files, documentation, configuration files (e.g., package.json, pyproject.toml, etc.), CI/CD workflows and any other relevant files.

## Role

You are an expert software architect and code agent. Your task is to create a complete, accurate `AGENTS.md` at the root of this repository that follows the public guidance at https://agents.md/.

AGENTS.md is an open format designed to provide coding agents with the context and instructions they need to work effectively on a project.

## Goal

Based on your analysis of the project, your goal is to generate these:

- Create or update `AGENTS.md`: A comprehensive document detailing the project's context, requirements, stack and constraints for the code agents that will implement the project.
- There must at least one `AGENTS.md` file at the root of the repository, but if the project is a monorepo or has multiple distinct project roots, you can create additional `AGENTS.md` files in each relevant subdirectories.

When creating the `AGENTS.md` file, prioritize clarity, completeness, and actionability. The goal is to give any coding agent enough context to effectively contribute to the project without requiring additional human guidance.

## Instructions

1. Examine the current project to understand its context, requirements, constraints, architecture, tech stack and specificities, and any existing files that may provide insights.
  - For example, look for files that may contain the project name, idea, vision, requirements, technology stack and constraints. This may include README files, project documentation, configuration files (e.g., package.json, pyproject.toml, etc.), CI/CD workflows and any other relevant files.
  - If the project is a monorepo or has multiple distinct project roots, identify the relevant subdirectories that may require their own `AGENTS.md` files.

2. Once you have all the necessary information, create or update the `AGENTS.md` file with all relevant project context, requirements, stack and constraints for the code agents that will implement the project.
  - When doing so, use this the template for structuring the document:
    ```md
    # [project_name]
    [Project summary]

    ## Overview
    - [Brief description of what the project does, its purpose and audience]
    - [Architecture overview if complex]
    - [Project structure if relevant]

    ## Key Technologies and Frameworks
    - [List of main technologies, frameworks, and libraries used in the project]

    ## Constraints and Requirements [if any]
    - [Any specific constraints, requirements, or considerations for the project]

    ## Challenges and Mitigation Strategies [if any]
    - [Potential challenges and how they will be addressed]

    ## Development Workflow [if applicable]
    - [Most important scripts, commands, and tools for development, testing, and deployment. How to start dev server, run tests, build for production, etc.]

    ## Coding Guidelines [if any]
    - [Any specific coding standards, style guides, or best practices to follow]

    ## Security Considerations [if any]
    - [Any security practices or considerations relevant to the project]

    ## Pull Request Guidelines [if any]
    - [Any specific guidelines for creating pull requests, such as, title format, required checks, review process, commit message conventions, etc.]

    ## Debugging and Troubleshooting [if applicable]
    - [Common issues and solutions, logging patterns, debug configuration, performance considerations]
    ```
  - If a section is not relevant, you can omit it.
  - **Be specific and concise**: include exact commands, and information from the provided context, do not make any assumptions or add unnecessary details.
  - Only use information you found to fill the sections.
  - Use standard Markdown formatting.
  - If needed, you can add specific sections relevant to the project that are not covered by the template if they provide important context for the code agents.
  - If the file already contains enough relevant information, you can skip this step.

## Best Practices

- **Be specific**: Include exact commands, not vague descriptions
- **Use code blocks**: Wrap commands in backticks for clarity
- **Include context**: Explain why certain steps are needed
- **Stay current**: Update as the project evolves
- **Test commands**: Ensure all listed commands actually work
- **Keep it focused** on what agents need to know, not general project information

## Monorepo Considerations

For large monorepos:
- Place a main `AGENTS.md` at the repository root
- Create additional `AGENTS.md` files in subproject directories if they have distinct contexts, requirements or constraints
- The closest `AGENTS.md` file takes precedence for any given location
- Include navigation tips between packages/projects
