import os
from pathlib import Path

# === CONFIGURATION ===
# Directories to completely bypass to avoid unreadable files and bloat
EXCLUDE_DIRS = {
    "node_modules", 
    ".git", 
    "dist", 
    "build", 
    "assets",      # Skipping the binary webp image directory
    "__pycache__"
}

# Only gather standard textual files to prevent corruption or binary read errors
ALLOWED_SUFFIXES = {
    ".js", 
    ".jsx", 
    ".css", 
    ".json", 
    ".html", 
    ".md"
}

# Names of files we should ignore (including this script itself)
EXCLUDE_FILES = {
    "package-lock.json",
    "dump_codebase.py"
}

OUTPUT_FILE_NAME = "codebase_dump.md"

def format_file_content(file_path: Path, project_root: Path) -> str:
    """
    Reads a file and wraps its content inside a clean markdown block with headers.
    """
    relative_path = file_path.relative_to(project_root)
    # Determine the markdown code block syntax language based on file extension
    suffix = file_path.suffix.lstrip(".")
    if suffix == "jsx":
        language = "javascript"
    elif suffix == "js":
        language = "javascript"
    else:
        language = suffix

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        content = f"Error reading file contents: {e}"

    return f"\n---\n### `{relative_path}`\n```{language}\n{content}\n```\n"

def collect_valid_files(root_dir: Path) -> list:
    """
    Recursively scans the directory and gathers paths of all text files matching criteria.
    """
    valid_files = []
    for path in root_dir.rglob("*"):
        # Check if any parent directory of this path is in the exclude list
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
            
        if (
            path.is_file() and
            path.suffix in ALLOWED_SUFFIXES and
            path.name not in EXCLUDE_FILES and
            path.name != OUTPUT_FILE_NAME
        ):
            valid_files.append(path)
            
    return sorted(valid_files)

def main():
    # Resolve the active workspace directory where this script is executed
    project_root = Path(__file__).resolve().parent
    output_path = project_root / OUTPUT_FILE_NAME

    print(f"Scanning target directory: {project_root}")
    all_files = collect_valid_files(project_root)
    print(f"Located {len(all_files)} matching codebase files.")

    print(f"Writing structured contents to {OUTPUT_FILE_NAME}...")
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("# 📦 Gothic Art Animator Codebase Dump\n")
            f.write("This file compiled your active components, stores, styles, layouts, and engine scripts.\n")
            
            for file_path in all_files:
                f.write(format_file_content(file_path, project_root))
                
        print(f"✅ Compilation finished! Open '{OUTPUT_FILE_NAME}' in your editor.")
    except Exception as error:
        print(f"❌ Failed to write codebase dump file: {error}")

if __name__ == "__main__":
    main()