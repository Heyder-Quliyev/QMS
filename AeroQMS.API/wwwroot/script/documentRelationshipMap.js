function relationshipMapDeps() {
  return window.__documentRelationshipMapDeps || {};
}

function relationshipMapApiBaseUrl() {
  return relationshipMapDeps().API_BASE_URL || '/api';
}

function relationshipMapEscapeHtml(value) {
  const fn = relationshipMapDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function relationshipMapShowToast(message, type = 'info') {
  const fn = relationshipMapDeps().showToast;
  if (typeof fn === 'function') return fn(message, type);
  console.log(`[Toast] ${type}: ${message}`);
}

function relationshipMapViewDocument(id) {
  const fn = relationshipMapDeps().viewDocument;
  if (typeof fn === 'function') return fn(id);
}

function relationshipMapGetStatusBadge(status) {
  const fn = relationshipMapDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function getRelationshipMapNodeKind(nodeId) {
  const id = String(nodeId || '');
  if (id.startsWith('doc-')) return 'doc';
  if (id.startsWith('ncr-')) return 'ncr';
  if (id.startsWith('capa-')) return 'capa';
  return 'unknown';
}

function relationshipMapStatusKey(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function getRelationshipMapNodeFill(status) {
  const s = relationshipMapStatusKey(status);
  if (s === 'approved' || s === 'valid' || s === 'complete' || s === 'closed' || s === 'completed' || s === 'verified') return '#10b981';
  if (s === 'due_for_review' || s === 'expiring' || s === 'under_review' || s === 'investigation' || s === 'open' || s === 'pending_verification' || s === 'in_progress') return '#f59e0b';
  if (s === 'expired' || s === 'overdue' || s === 'rejected' || s === 'suspended') return '#ef4444';
  return '#6b7280';
}

function getRelationshipMapLinkColor(type) {
  const t = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (t === 'references') return '#3b82f6';
  if (t === 'supersedes') return '#8b5cf6';
  if (t === 'related_to') return '#6b7280';
  if (t === 'linked_ncr' || t === 'linked_capa' || t === 'ncr') return '#f59e0b';
  return '#6b7280';
}

function getRelationshipMapNodeStroke(node) {
  const kind = getRelationshipMapNodeKind(node?.id);
  if (kind === 'doc') return 'rgba(255,255,255,0.35)';
  if (kind === 'ncr') return 'rgba(249,115,22,0.9)';
  if (kind === 'capa') return 'rgba(249,115,22,0.9)';
  return 'rgba(255,255,255,0.25)';
}

function relationshipMapNodeRadius(node, degreeById) {
  const deg = degreeById.get(node.id) || 0;
  return Math.max(18, Math.min(40, 18 + deg * 2.6));
}

function closePanel() {
  const panel = document.getElementById('side-panel');
  if (panel) panel.style.display = 'none';
}

function resetView() {
  const s = window.__relationshipMap;
  if (!s?.svg || !s?.zoom || !window.d3) return;
  const t = d3.zoomIdentity;
  s.svg.transition().duration(650).call(s.zoom.transform, t);
  if (typeof s.clearHighlight === 'function') s.clearHighlight();
}

function toggleLabels() {
  const s = window.__relationshipMap;
  if (!s) return;
  s.labelsVisible = !s.labelsVisible;
  if (s.labelSel) s.labelSel.style('display', s.labelsVisible ? null : 'none');
}

async function initRelationshipMap() {
  const host = document.getElementById('relationship-canvas');
  const mapContainer = document.querySelector('#page-relationship-map .map-container');
  if (!host || !mapContainer || !window.d3) return;

  if (window.__relationshipMap?.destroy) {
    window.__relationshipMap.destroy();
  }

  host.innerHTML = '';
  const miniHost = document.getElementById('mini-canvas');
  if (miniHost) miniHost.innerHTML = '';

  const state = {
    svg: null,
    zoom: null,
    g: null,
    simulation: null,
    rawNodes: [],
    rawLinks: [],
    filteredNodes: [],
    filteredLinks: [],
    nodesById: new Map(),
    labelsVisible: true,
    selectedCategory: 'all',
    selectedDepth: 'all',
    focusNodeId: null,
    nodeSel: null,
    linkSel: null,
    labelSel: null,
    mini: {
      svg: null,
      width: 200,
      height: 150,
      nodeSel: null,
      linkSel: null,
      pending: false
    },
    destroy() {
      try { this.simulation?.stop(); } catch {}
      try { this.svg?.on('.zoom', null); } catch {}
      host.innerHTML = '';
      if (miniHost) miniHost.innerHTML = '';
      window.__relationshipMap = null;
    },
    clearHighlight() {
      if (this.nodeSel) this.nodeSel.select('circle').attr('opacity', 1);
      if (this.linkSel) this.linkSel.attr('opacity', 1);
    }
  };
  window.__relationshipMap = state;

  const categoryEl = document.getElementById('filter-category');
  const depthEl = document.getElementById('depth-selector');
  state.selectedCategory = String(categoryEl?.value || 'all');
  state.selectedDepth = String(depthEl?.value || 'all');

  if (categoryEl) {
    categoryEl.onchange = () => {
      state.selectedCategory = String(categoryEl.value || 'all');
      state.applyFiltersAndRender();
    };
  }
  if (depthEl) {
    depthEl.onchange = () => {
      state.selectedDepth = String(depthEl.value || 'all');
      state.applyFiltersAndRender();
    };
  }

  const res = await fetch(`${relationshipMapApiBaseUrl()}/documents/relationships/map`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  console.log('links:', data?.links);
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const nodeIdSet = new Set(nodes.map(n => String(n?.id || '')));
  const normalizedLinks = links.map(l => {
    const rawSource = l?.source ?? l?.source_doc_id ?? l?.sourceDocId ?? l?.sourceDocumentId;
    const rawTarget = l?.target ?? l?.target_doc_id ?? l?.targetDocId ?? l?.targetDocumentId;
    const rawType = l?.type ?? l?.relationship_type ?? l?.relationshipType ?? l?.relationshipTypeKey;

    let source = (rawSource && typeof rawSource === 'object' && rawSource.id != null) ? rawSource.id : rawSource;
    let target = (rawTarget && typeof rawTarget === 'object' && rawTarget.id != null) ? rawTarget.id : rawTarget;

    source = String(source ?? '');
    target = String(target ?? '');

    if (source && !nodeIdSet.has(source) && nodeIdSet.has(`doc-${source}`)) source = `doc-${source}`;
    if (target && !nodeIdSet.has(target) && nodeIdSet.has(`doc-${target}`)) target = `doc-${target}`;

    const type = String(rawType ?? 'related_to').trim().toLowerCase().replace(/\s+/g, '_');
    return { source, target, type };
  }).filter(l => l.source && l.target);
  state.rawNodes = nodes;
  state.rawLinks = normalizedLinks;

  const categories = Array.from(new Set(
    nodes
      .map(n => (getRelationshipMapNodeKind(n?.id) === 'doc' ? (n?.category || '') : ''))
      .filter(Boolean)
  )).sort((a, b) => String(a).localeCompare(String(b)));
  if (categoryEl) {
    const current = String(categoryEl.value || 'all');
    categoryEl.innerHTML = `<option value="all">All Categories</option>` + categories.map(c => `<option value="${relationshipMapEscapeHtml(String(c))}">${relationshipMapEscapeHtml(String(c))}</option>`).join('');
    categoryEl.value = categories.includes(current) ? current : 'all';
    state.selectedCategory = categoryEl.value;
  }

  state.applyFiltersAndRender = () => {
    const selectedCategory = String(state.selectedCategory || 'all');
    const selectedDepth = String(state.selectedDepth || 'all');

    const seededDocIds = new Set();
    for (const n of state.rawNodes) {
      if (getRelationshipMapNodeKind(n?.id) !== 'doc') continue;
      if (selectedCategory === 'all' || String(n?.category || '') === selectedCategory) {
        seededDocIds.add(String(n.id));
      }
    }

    let includedNodeIds = new Set(seededDocIds);
    for (const l of state.rawLinks) {
      const sId = String(l?.source || '');
      const tId = String(l?.target || '');
      if (!sId || !tId) continue;
      if (includedNodeIds.has(sId) || includedNodeIds.has(tId)) {
        includedNodeIds.add(sId);
        includedNodeIds.add(tId);
      }
    }

    if (state.focusNodeId && !includedNodeIds.has(state.focusNodeId)) {
      state.focusNodeId = null;
      closePanel();
    }

    let depthNodeIds = includedNodeIds;
    if (state.focusNodeId && selectedDepth !== 'all') {
      const depth = selectedDepth === '1' ? 1 : selectedDepth === '2' ? 2 : null;
      if (depth) {
        const adjacency = new Map();
        for (const l of state.rawLinks) {
          const sId = String(l?.source || '');
          const tId = String(l?.target || '');
          if (!sId || !tId) continue;
          if (!includedNodeIds.has(sId) || !includedNodeIds.has(tId)) continue;
          if (!adjacency.has(sId)) adjacency.set(sId, new Set());
          if (!adjacency.has(tId)) adjacency.set(tId, new Set());
          adjacency.get(sId).add(tId);
          adjacency.get(tId).add(sId);
        }
        const visited = new Set([state.focusNodeId]);
        let frontier = new Set([state.focusNodeId]);
        for (let i = 0; i < depth; i++) {
          const next = new Set();
          for (const id of frontier) {
            const neigh = adjacency.get(id);
            if (!neigh) continue;
            for (const nId of neigh) {
              if (!visited.has(nId)) {
                visited.add(nId);
                next.add(nId);
              }
            }
          }
          frontier = next;
        }
        depthNodeIds = visited;
      }
    }

    const filteredNodes = state.rawNodes.filter(n => depthNodeIds.has(String(n?.id || '')));
    const filteredLinks = state.rawLinks.filter(l => {
      const sId = String(l?.source || '');
      const tId = String(l?.target || '');
      return depthNodeIds.has(sId) && depthNodeIds.has(tId);
    });

    state.filteredNodes = filteredNodes.map(n => ({ ...n }));
    state.filteredLinks = filteredLinks.map(l => ({ ...l }));
    state.render();
  };

  state.render = () => {
    state.simulation?.stop();
    host.innerHTML = '';
    if (miniHost) miniHost.innerHTML = '';

    state.nodesById = new Map(state.filteredNodes.map(n => [String(n.id), n]));

    const width = Math.max(300, mapContainer.clientWidth || 0);
    const height = Math.max(420, mapContainer.clientHeight || 0);

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height);
    state.svg = svg;
    const g = svg.append('g');
    state.g = g;

    const zoom = d3.zoom().scaleExtent([0.1, 3]).on('zoom', event => {
      g.attr('transform', event.transform);
      state.updateMiniViewport();
    });
    state.zoom = zoom;
    svg.call(zoom);

    svg.append('defs').selectAll('marker')
      .data(['references', 'supersedes', 'related_to', 'linked_ncr', 'linked_capa'])
      .enter().append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => getRelationshipMapLinkColor(d));

    const degreeById = new Map();
    for (const l of state.filteredLinks) {
      const sId = String(l.source);
      const tId = String(l.target);
      degreeById.set(sId, (degreeById.get(sId) || 0) + 1);
      degreeById.set(tId, (degreeById.get(tId) || 0) + 1);
    }

    const linkSel = g.append('g')
      .selectAll('line')
      .data(state.filteredLinks)
      .enter().append('line')
      .attr('class', d => `link link-${relationshipMapEscapeHtml(String(d.type || ''))}`)
      .attr('stroke', d => getRelationshipMapLinkColor(d.type))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => String(d.type || '') === 'references' ? null : '5,5')
      .attr('marker-end', d => `url(#arrow-${String(d.type || 'related_to')})`)
      .attr('opacity', 1);
    state.linkSel = linkSel;

    const nodeSel = g.append('g')
      .selectAll('g')
      .data(state.filteredNodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) state.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) state.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('click', async (event, d) => {
        event.stopPropagation();
        state.focusNodeId = String(d.id);
        if (getRelationshipMapNodeKind(d.id) === 'doc') {
          const docId = parseInt(String(d.id).slice(4), 10);
          if (!Number.isFinite(docId)) return;
          await state.showNodePanel(docId);
        } else {
          relationshipMapShowToast(`${String(d.doc_number || 'Item')} selected`, 'info');
        }
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (getRelationshipMapNodeKind(d.id) !== 'doc') return;
        const docId = parseInt(String(d.id).slice(4), 10);
        if (!Number.isFinite(docId)) return;
        relationshipMapViewDocument(docId);
      });
    state.nodeSel = nodeSel;

    nodeSel.append('circle')
      .attr('r', d => relationshipMapNodeRadius(d, degreeById))
      .attr('fill', d => getRelationshipMapNodeFill(d.status))
      .attr('stroke', d => getRelationshipMapNodeStroke(d))
      .attr('stroke-width', 2);

    const labelSel = nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .style('display', state.labelsVisible ? null : 'none')
      .text(d => String(d.doc_number || ''));
    state.labelSel = labelSel;

    nodeSel.append('title').text(d => `${String(d.doc_number || '')}: ${String(d.title || '')}`);

    state.simulation = d3.forceSimulation(state.filteredNodes)
      .force('link', d3.forceLink(state.filteredLinks).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => relationshipMapNodeRadius(d, degreeById) + 10));

    state.simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source?.x ?? 0)
        .attr('y1', d => d.source?.y ?? 0)
        .attr('x2', d => d.target?.x ?? 0)
        .attr('y2', d => d.target?.y ?? 0);
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
      state.requestMiniUpdate();
    });

    svg.on('click', () => {
      state.clearHighlight();
    });

    state.initMiniMap(width, height);
    state.updateMiniViewport();
  };

  state.requestMiniUpdate = () => {
    if (!state.mini?.svg || state.mini.pending) return;
    state.mini.pending = true;
    requestAnimationFrame(() => {
      state.mini.pending = false;
      state.updateMiniMap();
      state.updateMiniViewport();
    });
  };

  state.initMiniMap = () => {
    const miniWrap = document.querySelector('#page-relationship-map .mini-map');
    if (!miniHost || !miniWrap) return;
    const w = Math.max(120, miniWrap.clientWidth || 200);
    const h = Math.max(90, miniWrap.clientHeight || 150);
    state.mini.width = w;
    state.mini.height = h;
    const mSvg = d3.select(miniHost).append('svg').attr('width', w).attr('height', h);
    state.mini.svg = mSvg;
    state.mini.linkSel = mSvg.append('g').selectAll('line').data(state.filteredLinks).enter().append('line')
      .attr('stroke', d => getRelationshipMapLinkColor(d.type))
      .attr('stroke-width', 1)
      .attr('opacity', 0.55);
    state.mini.nodeSel = mSvg.append('g').selectAll('circle').data(state.filteredNodes).enter().append('circle')
      .attr('r', 2.2)
      .attr('fill', d => getRelationshipMapNodeFill(d.status))
      .attr('opacity', 0.85);
    state.updateMiniMap();
  };

  state.updateMiniMap = () => {
    if (!state.mini?.svg || state.filteredNodes.length === 0) return;
    const w = state.mini.width;
    const h = state.mini.height;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of state.filteredNodes) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
    const pad = 30;
    minX -= pad;
    maxX += pad;
    minY -= pad;
    maxY += pad;
    const dx = Math.max(1, maxX - minX);
    const dy = Math.max(1, maxY - minY);
    const scale = Math.min(w / dx, h / dy);
    const tx = (w - dx * scale) / 2;
    const ty = (h - dy * scale) / 2;
    const mx = x => tx + (x - minX) * scale;
    const my = y => ty + (y - minY) * scale;

    state.mini.linkSel
      .attr('x1', d => mx(d.source?.x ?? 0))
      .attr('y1', d => my(d.source?.y ?? 0))
      .attr('x2', d => mx(d.target?.x ?? 0))
      .attr('y2', d => my(d.target?.y ?? 0));

    state.mini.nodeSel
      .attr('cx', d => mx(d.x ?? 0))
      .attr('cy', d => my(d.y ?? 0));

    state.mini.bounds = { minX, maxX, minY, maxY, scale, tx, ty, w, h };
  };

  state.updateMiniViewport = () => {
    const viewport = document.getElementById('mini-viewport');
    if (!viewport || !state.mini?.bounds || !state.svg) return;
    const b = state.mini.bounds;
    const mainW = state.svg.attr('width');
    const mainH = state.svg.attr('height');
    const w = parseFloat(mainW) || (mapContainer.clientWidth || 0);
    const h = parseFloat(mainH) || (mapContainer.clientHeight || 0);
    const z = d3.zoomTransform(state.svg.node());
    const x0 = (0 - z.x) / z.k;
    const y0 = (0 - z.y) / z.k;
    const x1 = (w - z.x) / z.k;
    const y1 = (h - z.y) / z.k;

    const mx = x => b.tx + (x - b.minX) * b.scale;
    const my = y => b.ty + (y - b.minY) * b.scale;
    const left = mx(x0);
    const top = my(y0);
    const right = mx(x1);
    const bottom = my(y1);
    const vw = Math.max(10, right - left);
    const vh = Math.max(10, bottom - top);

    viewport.style.transform = `translate(${left}px, ${top}px)`;
    viewport.style.width = `${vw}px`;
    viewport.style.height = `${vh}px`;
  };

  state.showNodePanel = async docId => {
    const panel = document.getElementById('side-panel');
    const content = document.getElementById('side-panel-content');
    if (!panel || !content) return;
    panel.style.display = 'block';
    content.innerHTML = '<div style="color:rgba(238,242,247,0.8);font-size:12px;">Loading...</div>';
    try {
      const r = await fetch(`${relationshipMapApiBaseUrl()}/documents/${docId}/relationships`, { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.document) {
        content.innerHTML = '<div style="color:rgba(238,242,247,0.8);font-size:12px;">Unable to load relationships.</div>';
        return;
      }
      content.innerHTML = state.renderPanelHtml(d);
    } catch {
      content.innerHTML = '<div style="color:rgba(238,242,247,0.8);font-size:12px;">Unable to load relationships.</div>';
    }
  };

  state.renderPanelHtml = data => {
    const doc = data.document || {};
    const refs = Array.isArray(data.references) ? data.references : [];
    const refBy = Array.isArray(data.referenced_by) ? data.referenced_by : [];
    const ncrs = Array.isArray(data.linked_ncrs) ? data.linked_ncrs : [];
    const capas = Array.isArray(data.linked_capas) ? data.linked_capas : [];
    const docId = doc.id;

    const relItems = (items, kind) => items.map(it => {
      if (kind === 'doc') {
        const nodeId = `doc-${it.doc_id}`;
        return `
          <div class="rel-item" onclick="focusNode('${relationshipMapEscapeHtml(String(nodeId))}');">
            <span class="rel-doc-number">${relationshipMapEscapeHtml(String(it.doc_number || ''))}</span>
            <span class="rel-doc-title">${relationshipMapEscapeHtml(String(it.title || ''))}</span>
          </div>
        `;
      }
      if (kind === 'ncr') {
        const nodeId = `ncr-${it.ncr_id}`;
        return `
          <div class="rel-item" onclick="focusNode('${relationshipMapEscapeHtml(String(nodeId))}');">
            <span class="rel-doc-number">NCR</span>
            <span class="rel-doc-title">${relationshipMapEscapeHtml(String(it.ncr_number || ''))}</span>
          </div>
        `;
      }
      if (kind === 'capa') {
        const nodeId = `capa-${it.capa_id}`;
        return `
          <div class="rel-item" onclick="focusNode('${relationshipMapEscapeHtml(String(nodeId))}');">
            <span class="rel-doc-number">CAPA</span>
            <span class="rel-doc-title">${relationshipMapEscapeHtml(String(it.capa_number || ''))}</span>
          </div>
        `;
      }
      return '';
    }).join('');

    return `
      <div class="panel-doc-header">
        <span class="doc-number" style="font-weight:800;">${relationshipMapEscapeHtml(String(doc.doc_number || ''))}</span>
        <span class="badge badge-${relationshipMapGetStatusBadge(String(doc.status || ''))}">${relationshipMapEscapeHtml(String(doc.status || ''))}</span>
      </div>
      <h3>${relationshipMapEscapeHtml(String(doc.title || ''))}</h3>
      <div class="panel-meta">
        <div class="meta-row"><label>Category</label><span>${relationshipMapEscapeHtml(String(doc.category || '-'))}</span></div>
        <div class="meta-row"><label>Revision</label><span>${relationshipMapEscapeHtml(String(doc.revision || '-'))}</span></div>
        <div class="meta-row"><label>Review Date</label><span>${doc.review_date ? new Date(doc.review_date).toLocaleDateString() : '-'}</span></div>
        <div class="meta-row"><label>Owner</label><span>${relationshipMapEscapeHtml(String(doc.owner || '-'))}</span></div>
      </div>
      <div class="panel-relationships">
        <h4 style="font-size:13px; margin: 12px 0 6px;">Relationships</h4>
        <div class="rel-section">
          <label>References (${refs.length})</label>
          ${refs.length ? relItems(refs, 'doc') : '<div style="color:var(--text-muted);font-size:12px;">None</div>'}
        </div>
        <div class="rel-section">
          <label>Referenced By (${refBy.length})</label>
          ${refBy.length ? relItems(refBy, 'doc') : '<div style="color:var(--text-muted);font-size:12px;">None</div>'}
        </div>
        <div class="rel-section">
          <label>Linked NCRs (${ncrs.length})</label>
          ${ncrs.length ? relItems(ncrs, 'ncr') : '<div style="color:var(--text-muted);font-size:12px;">None</div>'}
        </div>
        <div class="rel-section">
          <label>Linked CAPAs (${capas.length})</label>
          ${capas.length ? relItems(capas, 'capa') : '<div style="color:var(--text-muted);font-size:12px;">None</div>'}
        </div>
      </div>
      <div class="panel-actions">
        <button type="button" class="btn btn-primary" onclick="viewDocument(${Number(docId)})">Open Document</button>
        <button type="button" class="btn btn-ghost" onclick="highlightConnections('doc-${Number(docId)}')">Highlight Connections</button>
      </div>
    `;
  };

  state.applyFiltersAndRender();
}

function focusNode(nodeId) {
  const s = window.__relationshipMap;
  if (!s?.svg || !s?.zoom) return;
  const n = s.nodesById?.get(String(nodeId));
  if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
  const mapContainer = document.querySelector('#page-relationship-map .map-container');
  const width = Math.max(300, mapContainer?.clientWidth || 0);
  const height = Math.max(420, mapContainer?.clientHeight || 0);
  s.focusNodeId = String(nodeId);
  s.svg.transition().duration(750).call(
    s.zoom.transform,
    d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-n.x, -n.y)
  );
}

function highlightConnections(nodeId) {
  const s = window.__relationshipMap;
  if (!s?.nodeSel || !s?.linkSel) return;
  const centerId = String(nodeId || '');
  const connected = new Set([centerId]);
  for (const l of s.filteredLinks || []) {
    const sId = String(l.source?.id ?? l.source ?? '');
    const tId = String(l.target?.id ?? l.target ?? '');
    if (sId === centerId) connected.add(tId);
    if (tId === centerId) connected.add(sId);
  }
  s.nodeSel.select('circle').attr('opacity', d => connected.has(String(d.id)) ? 1 : 0.15);
  s.linkSel.attr('opacity', d => {
    const sId = String(d.source?.id ?? d.source ?? '');
    const tId = String(d.target?.id ?? d.target ?? '');
    return (sId === centerId || tId === centerId) ? 1 : 0.05;
  });
}

