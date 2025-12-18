#!/bin/bash

# Ollama startup script for M4 MacBook Pro (48GB RAM)
# Optimized for nomic-embed-text embeddings

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Ollama with optimized settings for embeddings...${NC}"

# Configuration for embedding workloads
# Higher parallelism since embeddings are faster than generation
# M4 MacBook Pro with 48GB RAM can handle high concurrency
export OLLAMA_NUM_PARALLEL=64
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_MAX_QUEUE=1024

# Optional: Set host/port if needed
export OLLAMA_HOST=127.0.0.1:11434

echo -e "${GREEN}Environment variables set:${NC}"
echo "  OLLAMA_NUM_PARALLEL=$OLLAMA_NUM_PARALLEL"
echo "  OLLAMA_MAX_LOADED_MODELS=$OLLAMA_MAX_LOADED_MODELS"
echo "  OLLAMA_MAX_QUEUE=$OLLAMA_MAX_QUEUE"

# Check if nomic-embed-text is already pulled
echo -e "\n${BLUE}Checking for nomic-embed-text model...${NC}"
if ollama list | grep -q "nomic-embed-text"; then
    echo -e "${GREEN}✓ nomic-embed-text already available${NC}"
else
    echo -e "${BLUE}Pulling nomic-embed-text model...${NC}"
    ollama pull nomic-embed-text
fi

# Start Ollama server
echo -e "\n${GREEN}Starting Ollama server...${NC}"
echo -e "${BLUE}Press Ctrl+C to stop${NC}\n"

ollama serve
