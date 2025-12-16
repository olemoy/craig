# CRAIG Implementation Roadmap

## Overview

CRAIG is implemented as 5 modular workpackages that can be developed in a coordinated sequence.

## Workpackage Summary

| WP | Name | Duration | Dependencies | Start |
|----|------|----------|--------------|-------|
| WP1 | Database Foundation | 2-3 days | None | Immediately |
| WP2 | File Processing | 3-4 days | WP1 (testing) | After WP1 started |
| WP3 | Embedding Engine | 2-3 days | WP1, WP2 | After WP1, WP2 started |
| WP4 | CLI Tool | 3-4 days | WP1, WP2, WP3 | After WP1-3 complete |
| WP5 | MCP Server | 3-4 days | WP1, WP3 | After WP1, WP3 complete |

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
**WP1: Database Foundation**
- Start immediately
- Blocks all other workpackages
- Critical path item

### Phase 2: Processing Layer (Days 3-7)
**WP2: File Processing + WP3: Embedding Engine**
- Can start once WP1 interfaces are defined
- Work in parallel
- Both needed for CLI

### Phase 3: Integration Layer (Days 7-14)
**WP4: CLI Tool + WP5: MCP Server**
- WP4 needs WP1, WP2, WP3
- WP5 needs WP1, WP3
- Can work in parallel

## Critical Integration Points

### Binary File Handling
Every workpackage must respect:
- **WP1**: `file_type='binary'`, `content=NULL`
- **WP2**: Metadata only, no chunking
- **WP3**: Skip entirely, no embeddings
- **WP4**: Show separately in progress
- **WP5**: Return metadata only in results

## Architecture Decision Records

All ADRs are in `/Users/Ole-Alexander.Moy/Navdev/craig/docs/architecture/`:
- ADR-001: Database Architecture
- ADR-002: File Processing Pipeline
- ADR-003: Embedding Strategy
- ADR-004: CLI Design
- ADR-005: MCP Server Protocol

## Workpackage Task Files

- `wp1-database-foundation.md`
- `wp2-file-processing.md`
- `wp3-embedding-engine.md`
- `wp4-cli-tool.md`
- `wp5-mcp-server.md`

## Next Steps

1. **Start WP1** - Database foundation (blocks everything)
2. **Then WP2 & WP3** - Once WP1 interfaces defined
3. **Finally WP4 & WP5** - After dependencies complete
4. **Integration testing** - Verify all components work together
