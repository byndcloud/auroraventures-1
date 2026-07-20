#!/usr/bin/env python3
"""
audit-a11y.py — Auditoria de acessibilidade via axe-core CLI

Uso:
    python audit-a11y.py <url>
    python audit-a11y.py http://localhost:5173
    python audit-a11y.py https://staging.meusite.com/pagina

Requer:
    npm install -g @axe-core/cli
    (ou npx @axe-core/cli <url>)

Saída:
    Relatório Markdown com violações agrupadas por severidade,
    pronto para ser incluído no contexto de análise.
"""

import subprocess
import sys
import json
from datetime import datetime


SEVERITY_LABELS = {
    "critical": "🔴 CRÍTICO",
    "serious":  "🟠 SÉRIO",
    "moderate": "🟡 MODERADO",
    "minor":    "🔵 MENOR",
}

SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"]


def run_axe(url: str) -> dict:
    """Executa axe-core CLI e retorna o resultado como dict."""
    try:
        result = subprocess.run(
            ["npx", "--yes", "@axe-core/cli", url, "--reporter", "json"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout.strip()
        if not output:
            print(f"ERRO: axe-core não retornou saída. stderr: {result.stderr}")
            sys.exit(1)
        return json.loads(output)
    except FileNotFoundError:
        print("ERRO: npx não encontrado. Instale Node.js e npm.")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print(f"ERRO: Timeout ao auditar {url}. Verifique se a URL está acessível.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERRO: Falha ao parsear output do axe-core: {e}")
        sys.exit(1)


def format_report(data: dict, url: str) -> str:
    """Formata o resultado do axe-core como Markdown."""
    violations = data.get("violations", [])
    passes = data.get("passes", [])

    lines = [
        f"# Relatório de Acessibilidade",
        f"",
        f"**URL auditada:** {url}  ",
        f"**Data:** {datetime.now().strftime('%d/%m/%Y %H:%M')}  ",
        f"**Violações encontradas:** {len(violations)}  ",
        f"**Regras aprovadas:** {len(passes)}",
        f"",
    ]

    if not violations:
        lines.append("✅ Nenhuma violação encontrada pela auditoria automatizada.")
        lines.append("")
        lines.append("> Nota: auditoria automatizada detecta ~30-40% dos problemas de a11y.")
        lines.append("> Teste manual com leitor de tela e navegação por teclado é essencial.")
        return "\n".join(lines)

    # Agrupa por severidade
    by_severity: dict[str, list] = {s: [] for s in SEVERITY_ORDER}
    for v in violations:
        sev = v.get("impact", "minor")
        by_severity.setdefault(sev, []).append(v)

    # Resumo
    lines.append("## Resumo")
    lines.append("")
    for sev in SEVERITY_ORDER:
        count = len(by_severity[sev])
        if count:
            label = SEVERITY_LABELS[sev]
            lines.append(f"- {label}: {count} violação(ões)")
    lines.append("")

    # Detalhes por severidade
    lines.append("## Violações Detalhadas")
    lines.append("")

    for sev in SEVERITY_ORDER:
        group = by_severity[sev]
        if not group:
            continue

        label = SEVERITY_LABELS[sev]
        lines.append(f"### {label}")
        lines.append("")

        for v in group:
            rule_id = v.get("id", "—")
            description = v.get("description", "—")
            help_url = v.get("helpUrl", "")
            nodes = v.get("nodes", [])

            lines.append(f"#### `{rule_id}`")
            lines.append(f"{description}")
            if help_url:
                lines.append(f"[Documentação]({help_url})")
            lines.append("")

            if nodes:
                lines.append(f"**Elementos afetados ({len(nodes)}):**")
                lines.append("")
                for node in nodes[:5]:  # Limita a 5 exemplos
                    target = node.get("target", [])
                    html = node.get("html", "")
                    failure = node.get("failureSummary", "")
                    lines.append(f"- Seletor: `{', '.join(target)}`")
                    if html:
                        lines.append(f"  ```html")
                        lines.append(f"  {html[:200]}{'...' if len(html) > 200 else ''}")
                        lines.append(f"  ```")
                    if failure:
                        lines.append(f"  **Fix:** {failure.replace('Fix', '').strip()}")
                    lines.append("")

                if len(nodes) > 5:
                    lines.append(f"  *(e mais {len(nodes) - 5} ocorrências...)*")
                    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("> **Importante:** Esta auditoria automatizada detecta aproximadamente")
    lines.append("> 30–40% dos problemas de acessibilidade. Complemente com:")
    lines.append("> - Teste manual com VoiceOver (macOS/iOS) ou NVDA (Windows)")
    lines.append("> - Navegação completa por teclado (Tab, Shift+Tab, Enter, Espaço, Escape)")
    lines.append("> - Verificação de contraste manual para cores customizadas")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Uso: python audit-a11y.py <url>")
        print("Exemplo: python audit-a11y.py http://localhost:3000")
        sys.exit(1)

    url = sys.argv[1]
    print(f"Auditando acessibilidade: {url}")
    print("Aguarde...")

    data = run_axe(url)
    report = format_report(data, url)

    print("\n" + report)


if __name__ == "__main__":
    main()
