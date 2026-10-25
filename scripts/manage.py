"""Explicit, local-only seed/index/reset operations. Run with python -m scripts.manage."""

import argparse
import shutil

from backend.config import ROOT, Settings
from backend.provider import Provider
from backend.retrieval import Retriever
from backend.store import Store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["seed", "index", "reset"])
    parser.add_argument("--confirm", default="", help="Reset requires exactly DELETE_LOCAL_SOURCEWELL_DATA")
    args = parser.parse_args()
    settings = Settings()
    if args.operation == "reset":
        if args.confirm != "DELETE_LOCAL_SOURCEWELL_DATA":
            parser.error("Stop the server, back up data, then pass --confirm DELETE_LOCAL_SOURCEWELL_DATA")
        directory = settings.data_dir.resolve()
        # A misconfigured DATA_DIR must never turn reset into arbitrary recursive deletion.
        if directory != (ROOT / "data").resolve():
            parser.error(
                "Reset only supports the project's default ./data directory. Handle other paths manually."
            )
        shutil.rmtree(directory, ignore_errors=True)
        print("Deleted local Sourcewell data. Restart the server to reseed fictional documents.")
        return
    store = Store(settings.data_dir)
    retriever = Retriever(store, settings, Provider(settings, store))
    for path in sorted((ROOT / "fixtures/documents").glob("*.md")):
        retriever.ingest(path.name, path.read_bytes(), doc_id=path.stem, seeded=True)
    if args.operation == "index":
        for doc in store.documents(public=settings.app_mode == "public"):
            retriever.index_document(doc["id"])
        print("Indexed all active documents with the configured embedding model.")
    else:
        print("Seeded fictional documents. No provider calls made.")


if __name__ == "__main__":
    main()
