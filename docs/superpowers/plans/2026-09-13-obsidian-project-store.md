# Obsidian Project Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist workbench project metadata in the user's Obsidian Vault without duplicating article bodies or source material.

**Architecture:** A Node-only Vault store resolves all project data below `04-内容创作/公众号/工作台项目`. Each project has a small `project.json` containing workflow metadata and file paths; no prose body is stored or generated. A later local service will expose this store to the browser and a Hermes adapter will create content versions in the referenced files.

**Tech Stack:** Node.js built-in `fs/promises`, Node test runner, JSON.

**Spec:** `../docs/superpowers/specs/2026-09-13-content-workbench-design.md`

## Global Constraints

- Vault root is `/Users/huachao/Documents/Obsidian Vault`.
- Project store lives only under `04-内容创作/公众号/工作台项目`.
- Store metadata and Obsidian relative paths only; never write article body, material, or a replacement Skill rule set.
- Do not call Hermes or WeChat in this task.

---

### Task 1: Create and load Vault project metadata

**Files:**
- Create: `lib/vault-store.mjs`
- Create: `tests/vault-store.test.mjs`

**Interfaces:**
- Produces `createVaultStore({ vaultRoot, workspaceRelativePath })`.
- Store methods: `saveProject(project)`, `listProjects()`, `getProject(id)`.

- [ ] Write a failing test that saves a project and verifies `project.json` contains its ID and no `body` field.
- [ ] Run `node --test tests/vault-store.test.mjs` and verify the missing module fails.
- [ ] Implement path validation, directory creation, atomic metadata writes, and sorted project listing.
- [ ] Run the store test and verify it passes.

### Task 2: Add explicit Obsidian file-path metadata

**Files:**
- Modify: `lib/vault-store.mjs`
- Modify: `tests/vault-store.test.mjs`

**Interfaces:**
- `saveProject(project)` stores `obsidianPath` as a relative path and rejects an absolute path outside the Vault.

- [ ] Write a failing test for accepting a Vault-relative path and rejecting traversal outside the workspace.
- [ ] Run the focused test and verify it fails.
- [ ] Implement the validation.
- [ ] Run the store tests and verify they pass.

### Task 3: Initialize the empty Vault workspace safely

**Files:**
- Create in Vault: `04-内容创作/公众号/工作台项目/.gitkeep`
- Create: `scripts/init-obsidian-workspace.mjs`

**Interfaces:**
- Script creates only the declared empty workspace directory and does not scan or alter existing article folders.

- [ ] Add a testable exported helper that calculates the exact workspace path.
- [ ] Verify it rejects a Vault root that does not include the required relative path.
- [ ] Run the initializer once against the user-provided Vault.
- [ ] Run the full Node test suite.
