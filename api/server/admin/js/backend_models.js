'use strict';

/** 백엔드 채널 모델 (ai-api app_settings 런타임 오버라이드).
 *
 * - 설정 탭: 채널별 현재 모델·출처·엔드포인트 + 변경 입력 → 연결 테스트 → 저장 /
 *   env 값으로 되돌리기. 저장은 서버가 테스트 통과 시에만 받는다.
 * - 모델·과금 탭: 같은 데이터를 읽기 전용으로 보여주고 단가 유무를 표시한다
 *   (호출이 아직 없는 모델도 여기서 단가를 미리 넣을 수 있게).
 *
 * 데이터: GET /llm-usage/active-models, PUT|DELETE /llm-usage/active-models/{channel},
 * POST /llm-usage/active-models/{channel}/test (Node 프록시 → ai-api).
 */
(function () {
  const A = window.BklAdmin;

  const SRC_LABEL = { db: '어드민 설정', env: '환경변수', default: '코드 기본값' };
  let rows = [];

  function srcBadge(r) {
    return `<span class="badge badge-src-${r.source}">${SRC_LABEL[r.source] || r.source}</span>`;
  }

  async function fetchActive() {
    const j = await A.getJSON('/llm-usage/active-models');
    rows = j.rows || [];
    return rows;
  }

  /* ── 모델·과금 탭: 읽기 전용 패널 ───────────────────────────── */
  async function renderReadonly(onPrefillPrice) {
    const tbody = document.getElementById('llm-active-tbody');
    if (!tbody) return;
    try {
      await fetchActive();
    } catch (e) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><span class="err-text">${A.escHtml(e.message)}</span></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => `<tr>
      <td class="cell-desc"><b>${A.escHtml(r.label)}</b><div class="user-email">${A.escHtml(r.description || '')}</div></td>
      <td class="cell-model"><code>${A.escHtml(r.effective)}</code></td>
      <td>${srcBadge(r)}</td>
      <td class="mono-small">${A.escHtml(r.endpoint || '')}</td>
      <td class="num">${A.fmtNum(r.usage_calls)}</td>
      <td>${r.priced
        ? '<span class="badge badge-ok">적용</span>'
        : `<button class="btn-link" data-prefill="${A.escHtml(r.effective)}"><span class="badge badge-warn">단가 미입력</span></button>`}</td>
    </tr>`).join('');
    tbody.querySelectorAll('[data-prefill]').forEach((b) => b.addEventListener('click', () => onPrefillPrice?.(b.dataset.prefill)));
    document.querySelectorAll('.link-tab[data-goto]').forEach((a) => {
      a.onclick = () => A.switchTab(a.dataset.goto);
    });
  }

  /** 단가 폼 datalist 등에 쓸 활성 모델명 (중복 제거). */
  function activeModelNames() {
    return [...new Set(rows.map((r) => r.effective).filter(Boolean))];
  }

  /* ── 설정 탭: 편집 테이블 ──────────────────────────────────── */
  function setMsg(tr, text, cls) {
    const el = tr.querySelector('.bm-msg');
    el.textContent = text || '';
    el.className = 'bm-msg' + (cls ? ' ' + cls : '');
  }

  async function renderEditable() {
    const tbody = document.getElementById('backend-models-tbody');
    if (!tbody) return;
    try {
      await fetchActive();
    } catch (e) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><span class="err-text">ai-api 연결 실패: ${A.escHtml(e.message)}</span></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => `<tr data-channel="${A.escHtml(r.channel)}">
      <td class="cell-desc"><b>${A.escHtml(r.label)}</b><div class="user-email">${A.escHtml(r.channel)} · ${A.escHtml(r.description || '')}</div></td>
      <td class="cell-model"><code>${A.escHtml(r.effective)}</code>
        ${r.source === 'db' && r.env_value ? `<div class="user-email">env: ${A.escHtml(r.env_value)}</div>` : ''}
        ${r.source === 'db' && r.updated_at ? `<div class="user-email">${A.fmtKST(r.updated_at)} · ${A.escHtml(r.updated_by || '')}</div>` : ''}
      </td>
      <td>${srcBadge(r)}</td>
      <td class="mono-small">${A.escHtml(r.endpoint || '')}<div class="user-email">${A.escHtml(r.transport)}</div></td>
      <td>
        <input class="bm-input" type="text" placeholder="새 모델명" value="" list="llm-model-list" />
        <span class="bm-msg"></span>
      </td>
      <td style="white-space:nowrap">
        <button class="btn-link" data-act="test">연결 테스트</button>
        <button class="btn-link" data-act="save"><b>테스트 후 저장</b></button>
        ${r.source === 'db' ? '<button class="btn-link danger" data-act="revert">env 값으로</button>' : ''}
      </td>
    </tr>`).join('');

    tbody.querySelectorAll('tr[data-channel]').forEach((tr) => {
      const ch = tr.dataset.channel;
      const input = tr.querySelector('input');
      const btns = [...tr.querySelectorAll('button')];
      const busy = (on) => btns.forEach((b) => { b.disabled = on; });

      tr.querySelector('[data-act="test"]').addEventListener('click', async () => {
        const model = input.value.trim();
        if (!model) return setMsg(tr, '모델명을 입력하세요.', 'err');
        busy(true); setMsg(tr, '연결 테스트 중...');
        try {
          const t = await A.sendJSON('POST', `/llm-usage/active-models/${encodeURIComponent(ch)}/test`, { model });
          setMsg(tr, t.ok ? `OK · ${t.latency_ms}ms · ${t.transport}` : `실패: ${t.detail}`, t.ok ? 'ok' : 'err');
        } catch (e) {
          setMsg(tr, '오류: ' + e.message, 'err');
        } finally { busy(false); }
      });

      tr.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const model = input.value.trim();
        if (!model) return setMsg(tr, '모델명을 입력하세요.', 'err');
        busy(true); setMsg(tr, '연결 테스트 후 저장 중...');
        try {
          const j = await A.sendJSON('PUT', `/llm-usage/active-models/${encodeURIComponent(ch)}`, { model, test: true, updated_by: 'admin-ui' });
          setMsg(tr, `저장됨 · ${j.test ? j.test.latency_ms + 'ms' : ''} · 최대 30초 내 전 프로세스 반영`, 'ok');
          await renderEditable();
        } catch (e) {
          // 422: {detail:{message,test}} — 테스트 실패 사유를 그대로 보여준다
          const d = e.detail && typeof e.detail === 'object' ? e.detail : null;
          setMsg(tr, d?.test ? `저장 안 됨 — ${d.test.detail}` : '오류: ' + e.message, 'err');
          busy(false);
        }
      });

      tr.querySelector('[data-act="revert"]')?.addEventListener('click', async () => {
        if (!confirm(`${ch} 오버라이드를 삭제하고 환경변수/기본값으로 되돌릴까요?`)) return;
        busy(true);
        try {
          await A.sendJSON('DELETE', `/llm-usage/active-models/${encodeURIComponent(ch)}`);
          await renderEditable();
        } catch (e) {
          setMsg(tr, '오류: ' + e.message, 'err');
          busy(false);
        }
      });
    });
  }

  window.BklAdmin.backendModels = { renderReadonly, renderEditable, activeModelNames, fetchActive };
})();
