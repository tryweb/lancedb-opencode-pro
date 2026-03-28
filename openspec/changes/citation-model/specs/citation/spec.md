# Memory Citation Specification

## Overview

This spec defines the citation model for tracking memory provenance and source verification.

## Requirements

### R1: Citation Metadata Storage
The system SHALL store citation information in memory metadata including:
- Source type (auto-capture, explicit-remember, import, external)
- Source timestamp
- Citation status (verified, pending, invalid, expired)

### R2: Citation Display
The system SHALL display citation information in memory search results when available.

### R3: Citation Validation
The system SHALL provide a citation validation function that checks:
- Source validity
- Freshness (optional)
- Chain of custody for derived memories

## Scenarios

### S1: Auto-captured memory citation
- WHEN memory is auto-captured from assistant output
- THEN citation source is recorded as "auto-capture" with current timestamp
- AND citation status is "verified" by default

### S2: Explicit remember citation
- WHEN user calls memory_remember tool
- THEN citation source is recorded as "explicit-remember" with current timestamp
- AND citation status is "verified"

### S3: Citation validation
- WHEN citation validation is triggered
- THEN system checks source validity and freshness
- AND updates citation status accordingly
