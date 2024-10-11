# Contribution Guidelines

We welcome contributions from the community! Contributions can take many forms, such as code, documentation, bug reports, or feature requests. However, please note the following restrictions and guidelines before contributing.

## License and Contribution Terms

- **Non-commercial use**: All contributions will fall under the **non-commercial use** restrictions of the current CoopyrightCode Light License (v1.1). This means that any code, documentation, or other contributions must only be used in projects or contexts where no commercial benefit is derived.
- **License agreement**: By contributing, you agree to be bound by the **CoopyrightCode Light License** terms. This includes the prohibition of commercial use and the understanding that a future version of the license may introduce additional terms regarding commercial use, blockchain-based contribution tracking, and remuneration.

If you are unsure whether your contribution aligns with the license or need clarification, please feel free to contact the project maintainers before submitting a contribution.

## How to Contribute

To ensure smooth collaboration, please follow the steps outlined below when contributing to this project.

### 1. Fork the Repository

Start by forking the repository to create your own copy. This allows you to work on your changes independently of the main project:

- Visit the main repository page and click the **Fork** button in the top right corner.
- This will create a copy of the repository under your GitHub account where you can make your changes.

### 2. Create a New Branch

It is a good practice to create a new branch for each feature or fix you're working on, rather than committing directly to the main branch of your forked repository. This makes it easier to manage changes and helps maintain the cleanliness of your Git history.

To create a new branch:

```{bash,.copy}
git checkout -b your-branch-name
```

Make sure to choose a descriptive name for your branch, such as `feature-add-docs` or `fix-bug-issue123`.

### 3. Make Your Changes

Once your branch is set up, you can start making changes to the codebase, documentation, or other aspects of the project. Be sure to:

- Follow the project's coding style and conventions.
- Include clear and descriptive commit messages.
- Write tests if necessary, especially when submitting code changes.
- Ensure that your code or documentation aligns with the non-commercial terms of the CoopyrightCode Light License.

### 4. Submit a Pull Request

When you're ready to submit your changes, follow these steps:

- **Push your changes**: First, push your changes to your forked repository:

    ```{bash,.copy}
    git push origin your-branch-name
    ```

- **Open a pull request**: Visit the original repository (not your fork) and open a pull request (PR) from your branch. Be sure to include a descriptive title and a clear explanation of the changes you've made in the PR description.

  In the PR description, please also include:
  
  - A reference to any related issues or tickets (if applicable).
  - Any context or reasoning behind the changes, especially if they might impact other parts of the project.
  
!!! example "Example of a clear PR description"

    ```{ markdown, .copy }
    ## Description
    This PR adds new documentation for the contribution process and fixes minor typos in the README file.

    ## Related Issue
    Fixes issue #123

    ## Context
    The documentation was outdated and needed to be updated to reflect the current workflow.
    ```

!!! warning "Be patient"

    Once your pull request is submitted, the maintainers will review it and may ask for additional changes or clarifications. Please be patient as the review process takes time, and respond to any feedback you receive.

### 5. Respond to Feedback

During the review process, maintainers may request changes or ask for additional explanations. It's important to:

- Address feedback in a timely manner.
- Push additional commits to your branch to update your pull request.
- Communicate if you're unable to make the requested changes.

Once the pull request is approved, it will be merged into the main repository. You will be credited for your contribution!

## Code of Conduct

We expect all contributors to follow our [Code of Conduct](CODE_OF_CONDUCT.md) when interacting with the project. This includes respecting others' opinions, being considerate in your communications, and ensuring a welcoming and collaborative environment for all contributors.

## Good Practices for Contributors

Here are a few additional best practices to keep in mind when contributing:

- **Write clear commit messages**: Each commit should have a clear message that describes the purpose of the changes. This helps others (and your future self) understand what each commit does.
    Example: `Fix typo in README.md` or `Add unit tests for User model`.
  
- **Test your changes**: If you're submitting code changes, be sure to test them thoroughly. If the project has automated tests, run them to ensure your changes don't break existing functionality.
  
- **Document your changes**: If you're adding new features or making significant changes to the codebase, update the relevant documentation. This ensures that other contributors and users of the project can understand how to use the new functionality.
  
- **Respect the non-commercial license**: Ensure that your contributions align with the CoopyrightCode Light License terms. If you're unsure whether something qualifies as "non-commercial," feel free to ask the maintainers for clarification.

---

Thank you for your interest in contributing to this project! Your contributions help improve the project and expand its usefulness to the community. We look forward to collaborating with you.
