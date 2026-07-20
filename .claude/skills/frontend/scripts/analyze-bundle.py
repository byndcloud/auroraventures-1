#!/usr/bin/env python3
"""
analyze-bundle.py — Análise de tamanho de bundle front-end

Suporta:
    - Vite (stats gerados por rollup-plugin-visualizer ou vite --reporter json)
    - Webpack Bundle Analyzer (stats.json via webpack --profile --json > stats.json)
    - Next.js (.next/build-manifest.json)

Uso:
    python analyze-bundle.py <path-to-stats.json>
    python analyze-bundle.py ./dist/stats.json
    python analyze-bundle.py ./.next/build-manifest.json

Saída:
    Relatório Markdown com os maiores módulos, duplicatas e sugestões de otimização.
"""

import json
import sys
import os
from pathlib import Path
from typing import Any


# Threshold em bytes para alertas
CHUNK_WARNING_KB = 100
CHUNK_CRITICAL_KB = 300

# Dependências conhecidas com alternativas mais leves
HEAVY_DEPS = {
    "moment": {
        "size_kb": "~300KB",
        "alternatives": ["date-fns (~20KB)", "dayjs (~7KB)", "Temporal API (nativa)"],
    },
    "lodash": {
        "size_kb": "~70KB",
        "alternatives": ["importe funções individualmente: import groupBy from 'lodash/groupBy'"],
    },
    "axios": {
        "size_kb": "~13KB",
        "alternatives": ["fetch nativo (zero KB)", "ky (~4KB)"],
    },
    "jquery": {
        "size_kb": "~30KB",
        "alternatives": ["JavaScript nativo (querySelector, fetch, classList)"],
    },
}


def parse_webpack_stats(data: dict) -> list[dict]:
    """Extrai módulos do formato webpack stats.json."""
    chunks = []
    for chunk in data.get("chunks", []):
        name = " + ".join(chunk.get("names", ["unnamed"]))
        size = chunk.get("size", 0)
        modules = [m.get("name", "") for m in chunk.get("modules", [])]
        chunks.append({"name": name, "size": size, "modules": modules})
    return chunks


def parse_vite_stats(data: dict) -> list[dict]:
    """Extrai módulos do formato Rollup/Vite (vite-bundle-visualizer)."""
    chunks = []
    if "tree" in data:
        # Formato rollup-plugin-visualizer
        def walk(node, depth=0):
            if "children" not in node:
                chunks.append({
                    "name": node.get("name", "unknown"),
                    "size": node.get("value", 0),
                    "modules": [],
                })
            else:
                for child in node.get("children", []):
                    walk(child, depth + 1)
        walk(data["tree"])
    return chunks


def parse_nextjs_build(data: dict) -> list[dict]:
    """Extrai chunks do Next.js build-manifest.json."""
    chunks = []
    pages = data.get("pages", {})
    seen = set()
    for page, files in pages.items():
        for f in files:
            if f not in seen:
                seen.add(f)
                chunks.append({"name": f, "size": 0, "modules": [], "page": page})
    return chunks


def detect_format(data: dict) -> str:
    """Detecta o formato do arquivo de stats."""
    if "chunks" in data and "modules" in data:
        return "webpack"
    if "tree" in data or ("files" in data and "bundleSize" in data):
        return "vite"
    if "pages" in data and "ampFirstPages" in data:
        return "nextjs"
    return "unknown"


def find_duplicates(chunks: list[dict]) -> list[str]:
    """Encontra módulos aparecendo em múltiplos chunks."""
    seen: dict[str, int] = {}
    for chunk in chunks:
        for mod in chunk.get("modules", []):
            base = mod.split("?")[0].split("/node_modules/")[-1].split("/")[0]
            if base:
                seen[base] = seen.get(base, 0) + 1
    return [m for m, count in seen.items() if count > 1]


def check_heavy_deps(chunks: list[dict]) -> list[dict]:
    """Verifica se dependências pesadas estão presentes."""
    found = []
    all_modules = [m for c in chunks for m in c.get("modules", [])]
    all_text = " ".join(all_modules).lower()
    for dep, info in HEAVY_DEPS.items():
        if dep in all_text:
            found.append({"dep": dep, **info})
    return found


def format_size(bytes_: int) -> str:
    if bytes_ == 0:
        return "tamanho desconhecido"
    kb = bytes_ / 1024
    if kb < 1024:
        return f"{kb:.1f} KB"
    return f"{kb / 1024:.2f} MB"


def format_report(chunks: list[dict], source_path: str, fmt: str) -> str:
    lines = [
        "# Relatório de Análise de Bundle",
        "",
        f"**Arquivo:** `{source_path}`  ",
        f"**Formato detectado:** {fmt}  ",
        f"**Total de chunks:** {len(chunks)}",
        "",
    ]

    # Ordena por tamanho (maior primeiro)
    sorted_chunks = sorted(
        [c for c in chunks if c["size"] > 0],
        key=lambda x: x["size"],
        reverse=True
    )

    if not sorted_chunks:
        lines.append("> Não foi possível extrair tamanhos de chunks deste formato.")
        lines.append("> Verifique se o arquivo está no formato correto.")
        return "\n".join(lines)

    total_size = sum(c["size"] for c in sorted_chunks)
    lines.append(f"**Tamanho total (não-gzipped):** {format_size(total_size)}")
    lines.append("")

    # Top chunks
    lines.append("## Maiores Chunks")
    lines.append("")

    for chunk in sorted_chunks[:15]:
        size_kb = chunk["size"] / 1024
        flag = ""
        if size_kb > CHUNK_CRITICAL_KB:
            flag = " 🔴"
        elif size_kb > CHUNK_WARNING_KB:
            flag = " 🟡"
        lines.append(f"- `{chunk['name']}` — **{format_size(chunk['size'])}**{flag}")

    lines.append("")

    # Alertas de tamanho
    critical = [c for c in sorted_chunks if c["size"] / 1024 > CHUNK_CRITICAL_KB]
    warnings = [c for c in sorted_chunks if CHUNK_WARNING_KB < c["size"] / 1024 <= CHUNK_CRITICAL_KB]

    if critical:
        lines.append("## 🔴 Chunks Críticos (> 300KB)")
        lines.append("")
        lines.append("Estes chunks estão acima do limite recomendado.")
        lines.append("Considere code splitting agressivo.")
        lines.append("")
        for c in critical:
            lines.append(f"- `{c['name']}`: {format_size(c['size'])}")
        lines.append("")

    if warnings:
        lines.append("## 🟡 Chunks Atenção (100–300KB)")
        lines.append("")
        for c in warnings:
            lines.append(f"- `{c['name']}`: {format_size(c['size'])}")
        lines.append("")

    # Duplicatas
    duplicates = find_duplicates(chunks)
    if duplicates:
        lines.append("## ⚠️ Possíveis Duplicatas")
        lines.append("")
        lines.append("Módulos encontrados em múltiplos chunks — podem estar sendo")
        lines.append("incluídos mais de uma vez no bundle final:")
        lines.append("")
        for d in duplicates[:10]:
            lines.append(f"- `{d}`")
        lines.append("")
        lines.append("**Ação:** verifique `optimization.splitChunks` (Webpack) ou")
        lines.append("`build.rollupOptions.output.manualChunks` (Vite).")
        lines.append("")

    # Dependências pesadas
    heavy = check_heavy_deps(chunks)
    if heavy:
        lines.append("## 📦 Dependências com Alternativas Mais Leves")
        lines.append("")
        for h in heavy:
            lines.append(f"### `{h['dep']}` (~{h['size_kb']})")
            lines.append("Alternativas recomendadas:")
            for alt in h["alternatives"]:
                lines.append(f"- {alt}")
            lines.append("")

    # Sugestões gerais
    lines.append("## Sugestões de Otimização")
    lines.append("")
    lines.append("1. **Code splitting por rota** — importe páginas dinamicamente")
    lines.append("2. **Lazy loading de componentes pesados** — carregue sob demanda")
    lines.append("3. **Tree shaking** — verifique se imports são específicos, não de barrel")
    lines.append("4. **Compressão** — Brotli > gzip para texto/JS")
    lines.append("5. **Externals** — considere CDN para libs estáveis (React, Vue)")
    lines.append("")
    lines.append("**Verificação de tamanho real:**")
    lines.append("```bash")
    lines.append("# Tamanho gzipped (mais próximo do real para o usuário)")
    lines.append("find dist -name '*.js' | xargs gzip -c | wc -c")
    lines.append("```")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Uso: python analyze-bundle.py <path-to-stats.json>")
        print("Exemplo: python analyze-bundle.py ./dist/stats.json")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"ERRO: Arquivo não encontrado: {path}")
        sys.exit(1)

    with open(path) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"ERRO: Arquivo JSON inválido: {e}")
            sys.exit(1)

    fmt = detect_format(data)
    print(f"Formato detectado: {fmt}")

    if fmt == "webpack":
        chunks = parse_webpack_stats(data)
    elif fmt == "vite":
        chunks = parse_vite_stats(data)
    elif fmt == "nextjs":
        chunks = parse_nextjs_build(data)
    else:
        print("AVISO: Formato não reconhecido. Tentando extração genérica...")
        chunks = []

    report = format_report(chunks, str(path), fmt)
    print("\n" + report)


if __name__ == "__main__":
    main()
