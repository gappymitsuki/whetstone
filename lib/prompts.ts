import type { Rule } from "@/lib/types";

/** 蓄積ルールを LLM に渡せる形に整形 */
function formatRules(rules: Rule[]): string {
  if (rules.length === 0) {
    return "（まだ専門家由来のルールは蓄積されていません）";
  }
  return rules
    .map(
      (r) =>
        `- [${r.id}] 条件: ${r.pattern} / 判定: ${r.label} / 理由: ${r.reason}`
    )
    .join("\n");
}

/** 判定（/api/judge）用のプロンプト */
export function buildJudgePrompt(
  guideline: string,
  rules: Rule[],
  copy: string
): { system: string; user: string } {
  const system = `あなたはブランド広告コピーの審査担当です。与えられた【ガイドライン】に照らして、コピーが「適合」か「違反」かを判定します。

加えて、人間の専門家の過去判断から蓄積された【判断ルール集】を渡します。これは専門家が実際に下した判断を汎用化したもので、ガイドラインの公式な解釈指針として扱ってください。

判定方針：
- 該当するルールが明確に適用できる場合、それを正とみなして高い確信度で適用する。依拠したルールの id を reliedOnRuleIds に必ず列挙する。
- 該当ルールが無くても、ガイドラインから明らかに判断できる場合は高い確信度で判定する。
- 「明確に適用できるルールがある」または「ガイドラインから明らか」のとき → confidence は 85 以上。
- 該当ルールが無く、かつガイドラインの解釈が割れて本当に判断に迷う場合 → label は "要確認"、confidence は 70 未満。
- 推測で適合/違反を断定しない。迷うなら正直に "要確認" を選ぶ。

出力は厳密な JSON のみ。前置き・説明・コードフェンス（\`\`\`）は一切禁止。
出力スキーマ：
{ "label": "適合" | "違反" | "要確認", "confidence": 0-100 の整数, "rationale": "簡潔な理由（80字以内）", "reliedOnRuleIds": ["依拠したルールid", ...] }`;

  const user = `【ガイドライン】
${guideline}

【判断ルール集（専門家由来）】
${formatRules(rules)}

【審査対象コピー】
${copy}

このコピーを判定し、JSON のみを出力してください。`;

  return { system, user };
}

/** ルール汎用化（/api/generalize-rule）用のプロンプト */
export function buildGeneralizePrompt(
  guideline: string,
  copy: string,
  expertLabel: string,
  expertReason: string
): { system: string; user: string } {
  const system = `あなたは審査ルールの設計者です。専門家が個別のコピーに対して下した判断を、「特定のコピー本文に依存しない、再利用可能な汎用トリガー条件」へと一般化します。

要件：
- pattern は、その具体コピーだけでなく「同じ類型の別のコピー」にも当てはまる一般条件にする。固有名詞や特定フレーズをそのまま写さない。
- label は専門家の判断（適合/違反）をそのまま採用する。
- reason はガイドラインのどの観点に基づくかを簡潔に述べる。

良い例：
  入力コピー「業界No.1の書き心地」＋専門家「違反：客観的な根拠データが無い」
  → pattern「『No.1』『世界一』『最高』等の最上級・序列表現で、客観的根拠データ（調査機関・対象・時期）の添付が無いもの」, label「違反」, reason「ガイドライン1：最上級表現には根拠が必須」

出力は厳密な JSON のみ。前置き・説明・コードフェンスは一切禁止。
出力スキーマ：
{ "pattern": "特定コピーに依存しない一般的なトリガー条件", "label": "適合" | "違反", "reason": "理由（80字以内）" }`;

  const user = `【ガイドライン】
${guideline}

【専門家が判断したコピー】
${copy}

【専門家の判断】
判定: ${expertLabel}
理由: ${expertReason}

この判断を汎用ルールへ一般化し、JSON のみを出力してください。`;

  return { system, user };
}
