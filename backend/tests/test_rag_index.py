from app.tools import rag_lookup
from evals.reference_cases import REFERENCE_CASES


def test_guideline_vectors_are_embedded_once_and_reused_after_a_restart(monkeypatch):
    batches = []

    def embed(texts, task_type):
        batches.append(len(texts))
        return [[float(index), 1.0] for index, _ in enumerate(texts)]

    monkeypatch.setattr(rag_lookup.llm, "embed", embed)
    monkeypatch.setattr(rag_lookup, "loaded", {})
    first = rag_lookup.index_items()
    assert batches == [len(rag_lookup.guideline_sections())]

    monkeypatch.setattr(rag_lookup, "loaded", {})
    assert rag_lookup.index_items() == first
    assert len(batches) == 1

    edited = [{**section, "text": section["text"] + " Revised."} for section in rag_lookup.guideline_sections()]

    def revised_sections():
        return edited

    monkeypatch.setattr(rag_lookup, "guideline_sections", revised_sections)
    rag_lookup.index_items()
    assert len(batches) == 2


def test_hybrid_search():
    assert rag_lookup.keyword_ranking("roof age")[0] == "G2"
    dense = [{"id": "G1"}, {"id": "G2"}, {"id": "G3"}]
    assert [hit["id"] for hit in rag_lookup.fuse(dense, ["G2", "G3", "G1"])] == ["G2", "G1", "G3"]


def test_reference_notes():
    sections = {section["id"]: section for section in rag_lookup.guideline_sections()}
    assert [key for key in sections if key.startswith("G")] == [f"G{number}" for number in range(1, 13)]
    notes = {key: section for key, section in sections.items() if key.startswith("R")}
    assert {note["authority"] for note in notes.values()} == {"official", "standard", "industry", "research", "news"}
    assert all(note["source"] and "Source:" not in note["text"] and "Authority:" not in note["text"] for note in notes.values())
    assert {expected for _, expected in REFERENCE_CASES} == set(notes)


def test_references_follow_guidelines(monkeypatch):
    monkeypatch.setattr(rag_lookup, "AI_API_KEY", "test")
    monkeypatch.setattr(rag_lookup, "QDRANT_URL", "")
    monkeypatch.setattr(rag_lookup.llm, "embed", lambda texts, task_type: [[1.0]])
    monkeypatch.setattr(rag_lookup, "local_search", lambda vector, k: [{"id": section["id"]} for section in rag_lookup.guideline_sections()])
    ids = [hit["id"] for hit in rag_lookup.retrieve("terrorism pool cover per location", k=2, references=1)]
    assert [identifier[0] for identifier in ids] == ["G", "G", "R"]
    assert all(hit["id"].startswith("G") for hit in rag_lookup.retrieve("terrorism pool", k=3))
