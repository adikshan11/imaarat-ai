from app.tools import rag_lookup


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
