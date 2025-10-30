# Long Headline & Description Swap - Status Report

**Date:** 2025-10-30
**Campaign:** PMax-Brazil-POR (ID: 23202585091)
**Objective:** Replace all English long headlines and descriptions with Portuguese

## Results Summary

- ✅ **Asset Group #2 (Schools & Agents):** COMPLETE
- ✅ **Asset Group #3 (All Users):** COMPLETE
- ❌ **Asset Group #1 (InMarket):** Requires manual UI fix

---

## Asset Group #2: Schools & Agents ✅

**Long Headlines:** 5/5 Portuguese
- 303954226027 - "Estude Inglês em Dublin e Trabalhe Meio Período na Irlanda"
- 303867879563 - "Cursos de Inglês com Permissão de Trabalho - 20h por Semana"
- 303954232465 - "Aprenda Inglês em Dublin - Escola Credenciada há 35 Anos"
- 303954226129 - "Intercâmbio na Irlanda com Direito a Trabalhar Legalmente"
- 303954239821 - "Curso de Inglês + Visto de Trabalho - Comece em 2025"

**Descriptions:** 5/5 Portuguese
- 303954238030 - "Estude inglês no centro de Dublin. Acomodação garantida e suporte em português."
- 303954239908 - "Cursos para todos os níveis. Certificados oficiais e turmas pequenas."
- 303977566353 - "Escola credenciada com 35 anos de experiência. WiFi grátis e localização central."
- 303954240841 - "Trabalhe meio período enquanto estuda. Permissão de 20 horas por semana."
- 303954238150 - "Inscreva-se agora e reserve sua vaga para 2025. Preços e datas disponíveis."

---

## Asset Group #3: All Users ✅

**Long Headlines:** 5/5 Portuguese
(Same as Asset Group #2)

**Descriptions:** 5/5 Portuguese
(Same as Asset Group #2)

---

## Asset Group #1: InMarket ❌ BROKEN STATE

**Current Status:** Over asset limits - requires manual fix

**Long Headlines:** 11/5 (6 over limit)
- ✅ 4 Portuguese successfully added
- ❌ 7 English still present (should be 0)
- ❌ 1 Portuguese missing (303954239821)

**Descriptions:** 10/5 (5 over limit)
- ✅ 5 Portuguese successfully added
- ❌ 5 English still present (should be 0)

### Manual Fix Required

Go to Google Ads UI → PMax-Brazil-POR → Asset Group #1: InMarket

**Remove these Long Headlines:**
1. 41178176044 - "Stop wasting time. Bring your English to the next level..."
2. 41219225325 - "ULearn has been welcoming students like you since 1988"
3. 125831333236 - "Make the right choice today - 35 Years of Excellence..."
4. 223413070492 - "English Language School Dublin. Convenient location..."
5. 223413070495 - "English Courses For Levels A2, B1, B2 and C1..."
6. 303627645798 - "Estude Inglês na Irlanda com Permissão de Trabalho" (old Portuguese)
7. 303657118121 - "Leve seu ingles ao proximo nivel na ULearn..." (old Portuguese)

**Add this missing Long Headline:**
1. 303954239821 - "Curso de Inglês + Visto de Trabalho - Comece em 2025"

**Remove these Descriptions:**
1. 39720770603 - "Learn English In Dublin In Our School"
2. 39725975678 - "Since 1988 helping students to learn the English language..."
3. 41219225310 - "Learn the right way - let ULearn guide you to success"
4. 41219225316 - "There is no other school with our track record of success..."
5. 146646963887 - "Recognized, trusted, established - 35 years of success..."

---

## Technical Learnings

### What Worked ✅

**1-for-1 Sequential Swap Pattern:**
```javascript
// Remove 1 English
await customer.assetGroupAssets.remove([resourceName]);
await delay(500);

// Add 1 Portuguese
await customer.assetGroupAssets.create([{
  asset_group: `customers/${accountId}/assetGroups/${groupId}`,
  asset: `customers/${accountId}/assets/${assetId}`,
  field_type: 'LONG_HEADLINE'  // or 'DESCRIPTION'
}]);
await delay(500);
```

This successfully swapped assets in Asset Groups #2 and #3.

### What Failed ❌

**Bulk Removal:**
- Attempting to remove multiple assets at once caused "not allowed for removed resources" errors
- Cannot remove assets below minimum requirements (min 1 long headline, min 2 descriptions)
- Removals failed silently in Asset Group #1, but additions succeeded, creating over-limit situation

**Root Cause:** Asset Group #1 may have had assets in a "removed" or "pending" state that couldn't be removed via API.

---

## Files Created

**Working Scripts:**
- `.claude/tmp-code/swap-one-by-one.js` - ✅ Successfully swapped Groups #2 & #3
- `.claude/tmp-code/query-long-headlines-descriptions.js` - Query tool

**Failed Attempts:**
- `.claude/tmp-code/swap-long-headlines-descriptions.js` - mutateResources() structure errors
- `.claude/tmp-code/swap-sequential.js` - Violated minimum requirements
- `.claude/tmp-code/fix-asset-group-1.js` - Removals failed, additions succeeded (made it worse)

**Move to permanent location:**
- `swap-one-by-one.js` → `scripts/mcp/pmax/swap-asset-group-text-assets.js`

---

## Next Steps

1. **Manual UI Fix:** Remove excess English assets from Asset Group #1 via Google Ads UI
2. **Verify in UI:** Confirm all 3 asset groups have only Portuguese long headlines and descriptions
3. **Archive temp scripts:** Move working script to `scripts/mcp/pmax/`
4. **Update KB:** Add findings about asset removal limitations to API-knowledge

---

## Original Task List Status

From brazil-pmax-todo-status.md:

1. ✅ **Copy Search Themes** - Done in previous session
2. ⚠️ **Replace English headlines with Portuguese**
   - ✅ Regular Headlines (30 char) - Done previously
   - ⚠️ **Long Headlines (90 char) - 2/3 complete, 1 needs manual fix**
   - ⚠️ **Descriptions (90 char) - 2/3 complete, 1 needs manual fix**
3. ❌ **Sitelinks** - Created but not linked (campaign at 20/20 limit)
4. ✅ **Callouts** - Done previously
5. ❌ **Halloween promotion** - PROMOTION field type unsupported
6. ❌ **Portuguese price asset** - PRICE field type unsupported

**Overall Progress:** ~70% complete
