# Quick Start Guide

**For First-Time Users of lancedb-opencode-pro**

Complete the following steps to start using the long-term memory feature within 5 minutes.

---

## Prerequisites

- [ ] OpenCode **1.2.27 - 1.3.7** installed *(⚠️ 1.3.8+ has known NAPI bug, see [OPENCODE_COMPATIBILITY.md](OPENCODE_COMPATIBILITY.md))*
- [ ] Ollama installed and accessible
- [ ] Embedding model downloaded (`nomic-embed-text`)

---

## Step 1: Install the Plugin

### 1.1 Register the Plugin

Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "lancedb-opencode-pro"
  ]
}
```

If you already have other plugins, simply add `"lancedb-opencode-pro"` to the `plugin` array.

### 1.2 Verify Installation

Since OpenCode automatically downloads and installs plugins from npm, you can verify it has been cached correctly:

```bash
# Check if the plugin is cached (after restarting OpenCode)
ls ~/.cache/opencode/node_modules/lancedb-opencode-pro
```
*(Note: If you are installing from local source for development, your plugin might be manually linked in `~/.config/opencode/plugins/lancedb-opencode-pro`)*

---

## Step 2: Create Configuration

### 2.1 Create the Sidecar Config File

Create `~/.config/opencode/lancedb-opencode-pro.json`:

```json
{
  "provider": "lancedb-opencode-pro",
  "dbPath": "~/.opencode/memory/lancedb",
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

### 2.2 Configure Ollama Endpoint

Set `embedding.baseUrl` based on your Ollama location:

| Scenario | Config Value |
|----------|--------------|
| On the same machine as OpenCode | `http://127.0.0.1:11434` |
| On another machine in the LAN | `http://192.168.11.206:11434` |

---

## Step 3: Verify Ollama Connection

```bash
# Local Ollama
curl http://127.0.0.1:11434/api/tags

# Remote Ollama
curl http://192.168.11.206:11434/api/tags
```

Ensure the response includes the `nomic-embed-text` model.

---

## Step 4: Restart OpenCode

Close and restart OpenCode to load the plugin.

---

## Step 5: Verify Memory Features

### 5.1 Test Auto-Capture

Have a conversation in OpenCode, for example:

```
Please remember: This project uses Docker Compose for testing.
The command is docker compose build --no-cache && docker compose up -d
```

### 5.2 Test Memory Recall

Open a new conversation window and ask a related question:

```
How should I run the test environment?
```

If the memory feature is functioning correctly, OpenCode should automatically inject the previously memorized Docker command.

### 5.3 Manually Search Memory

```text
memory_search query="Docker Compose"
```

Expected output:

```
1. [abc123][auto-capture|verified] (project:your-project) 
   This project uses Docker Compose for testing... [85%]
```

---

## Step 6: Verify Database Files

```bash
# Check if the LanceDB files are created
ls -la ~/.opencode/memory/lancedb
```

If you see `.lance` files, it means the memory has been successfully persisted.

---

## Troubleshooting

> **⚠️ Critical Issue**: If you see "Memory store unavailable" error on OpenCode v1.3.8 or later, see [OPENCODE_COMPATIBILITY.md](OPENCODE_COMPATIBILITY.md). This is a known platform bug.

### Issue 1: Plugin Not Loaded

**Symptom**: OpenCode does not recognize `memory_*` tools

**Solution**:
```bash
# Check plugin path
ls ~/.config/opencode/plugins/lancedb-opencode-pro

# Check configuration file
cat ~/.config/opencode/lancedb-opencode-pro.json
```

### Issue 2: Ollama Connection Failed

**Symptom**: The `curl` command times out or connection is refused

**Solution**:
1. Ensure the Ollama service is running: `ollama serve`
2. Check firewall settings
3. Ensure the model is downloaded: `ollama list`

### Issue 3: Memory Not Auto-Captured

**Symptom**: No memory is generated after a conversation

**Possible Causes**:
- Content length < 80 characters (default threshold)
- The conversation has not triggered the `session.idle` event

**Solution**:
- Manually use the `memory_remember` tool
- Adjust the `minCaptureChars` setting

### Issue 4: Search Returns Empty

**Symptom**: `memory_search` yields no results

**Possible Causes**:
- No memories have been created yet
- The query keyword does not match

**Solution**:
```text
# Check if there are any memories
memory_stats

# Try a broader query
memory_search query="project"
```

---

## Next Steps

After completing the Quick Start, you can:

1. **Dive into advanced configuration** → [ADVANCED_CONFIG.md](ADVANCED_CONFIG.md)
2. **View all available tools** → [../README.md#memory-management-tools](../README.md#memory-management-tools)
3. **Understand the system architecture** → [architecture.md](architecture.md)

---

## Reference Resources

- [Full Configuration Options](ADVANCED_CONFIG.md#configuration-options)
- [Complete List of Memory Tools](../README.md#memory-management-tools)
- [Environment Variable Overrides](ADVANCED_CONFIG.md#environment-variable-overrides)
- [Switching Embedding Models](embedding-migration.md)

---

**Last Updated**: 2026-03-29  
**Supported Version**: v0.5.0+
