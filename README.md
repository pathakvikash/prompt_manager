# Prompt Manager

A command-line application for efficiently creating, organizing, editing, storing, and retrieving prompts with support for categories, tagging, and search functionality.

## Features:

- Create and store prompts
- Organize prompts by categories
- Tag prompts for easy retrieval
- Search functionality
- Edit and delete prompts

## Installation:

```bash
git clone https://github.com/your-username/prompt_manager.git
cd prompt_manager
pip install .
```

## Usage:

```bash
prompt_manager add "My Prompt" "This is the content of my prompt."
prompt_manager add "Welcome Message" "Hello {name}, welcome!" "Greetings" "personalization" "template"
prompt_manager list
prompt_manager search "content"
prompt_manager --web
```

## CLI Usage:

### `add <name> <content> [category] [tags...]`

Adds a new prompt to the manager. The `category` and `tags` are optional positional arguments.

- `<name>`: A unique name for your prompt (required).
- `<content>`: The actual text of the prompt (required).
- `[category]`: (Optional) A single word or phrase for categorizing the prompt. Defaults to "Uncategorized".
- `[tags...]`: (Optional) One or more space-separated tags to help organize and search for the prompt.

**Examples:**

```bash
prompt_manager add "My First Prompt" "Hello, AI!" "Greetings" "simple" "intro"
prompt_manager add "Marketing Idea" "Generate 5 marketing slogans for a new coffee brand." "Brainstorming"
prompt_manager add "Quick Reply" "Thanks for your message." # No category or tags
```

### `list`

Lists all available prompts, showing their name, category, tags, and a truncated view of their content.

**Example:**

```bash
prompt_manager list
```

### `get <name>`

Retrieves and displays the full content, category, and tags of a specific prompt by its name.

**Example:**

```bash
prompt_manager get "My First Prompt"
```

### `search <query>`

Searches for prompts whose name, content, category, or tags match the provided query (case-insensitive).

**Example:**

```bash
prompt_manager search "coffee"
prompt_manager search "Greetings"
```

### `edit <name> [--content <new_content>] [--category <new_category>] [--tags <new_tags...>]`

Edits an existing prompt. You must specify the prompt's name and at least one of the optional flags to update.

- `<name>`: The name of the prompt to edit (required).
- `--content <new_content>`: (Optional) New content for the prompt.
- `--category <new_category>`: (Optional) New category for the prompt.
- `--tags <new_tags...>`: (Optional) New space-separated tags for the prompt. If provided, replaces all existing tags.

**Examples:**

```bash
prompt_manager edit "My First Prompt" --content "Hello, AI! How are you today?"
prompt_manager edit "Marketing Idea" --category "Marketing" --tags "slogans" "branding"
prompt_manager edit "Quick Reply" --category "Templates" # Only update category
```

### `delete <name>`

Deletes a prompt by its name.

**Example:**

```bash
prompt_manager delete "Quick Reply"
```

## Web UI Usage:

To launch the graphical web interface:

```bash
prompt_manager --web
```
