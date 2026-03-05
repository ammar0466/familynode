// Data models
let nodesArray = [];
let edgesArray = [];
let nodes, edges, network;
let loadedNodes = new Set();
let allNodesIndex = [];

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const detailsPane = document.getElementById('details-pane');
const nodeContent = document.getElementById('nodeContent');
const closeDetailsBtn = document.getElementById('closeDetails');
const addNodeBtn = document.getElementById('addNodeBtn');
const editNodeBtn = document.getElementById('editNodeBtn');
const editModal = document.getElementById('edit-modal');
const cancelEditBtn = document.getElementById('cancelEdit');
const nodeForm = document.getElementById('nodeForm');
const modalTitle = document.getElementById('modalTitle');
const btnGraph = document.getElementById('btnGraph');
const btnTree = document.getElementById('btnTree');

const timelineSlider = document.getElementById('timelineSlider');
const timelineYearDisplay = document.getElementById('timelineYearDisplay');
const playTimelineBtn = document.getElementById('playTimelineBtn');

let isTreeView = false; // toggle state
let timelineYear = new Date().getFullYear();
let isPlayingTimeline = false;
let playInterval = null;

let minTimelineYear = timelineYear - 50; // default start
let maxTimelineYear = timelineYear;

function checkAndSetTimelineBounds(year) {
    if (!year || isNaN(year)) return;
    let changed = false;
    if (year < minTimelineYear) {
        minTimelineYear = year;
        changed = true;
    }
    if (year > maxTimelineYear) {
        maxTimelineYear = year;
        changed = true;
    }
    if (changed) {
        timelineSlider.min = minTimelineYear;
        timelineSlider.max = maxTimelineYear;
        // If slider was at minimum, and minimum just expanded backwards, keep it there visually,
        // or just update graph to reflect new boundary
        if (timelineYear < minTimelineYear) {
            timelineYear = minTimelineYear;
            timelineSlider.value = timelineYear;
        }
        updateGraphByTimeline();
    }
}

// Initialize Network Graph
function initNetwork() {
    const container = document.getElementById('graph-container');
    nodes = new vis.DataSet(nodesArray);
    edges = new vis.DataSet(edgesArray);

    const data = { nodes: nodes, edges: edges };
    const options = getNetworkOptions();

    network = new vis.Network(container, data, options);

    // Event listeners for graph interaction
    network.on("click", function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            handleNodeClick(nodeId);
        } else {
            hideDetailsPane();
        }
    });
}

function getNetworkOptions() {
    let options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: { color: '#ffffff', face: 'Outfit' },
            borderWidth: 2,
            color: {
                border: '#5e81ff',
                background: '#1b2336',
                highlight: { border: '#ffffff', background: '#5e81ff' }
            },
            shadow: {
                enabled: true,
                color: 'rgba(94, 129, 255, 0.4)',
                size: 10,
                x: 0, y: 0
            }
        },
        edges: {
            width: 2,
            color: { color: 'rgba(255,255,255,0.2)', highlight: '#5e81ff' },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: { type: 'continuous' }
        },
        interaction: { hover: true }
    };

    if (isTreeView) {
        options.layout = {
            hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: 150,
                levelSeparation: 150
            }
        };
        options.physics = {
            enabled: false // Physics creates chaos with hierarchical layout
        };
        options.edges.smooth = {
            type: 'cubicBezier',
            forceDirection: 'vertical',
            roundness: 0.4
        };
    } else {
        options.layout = {
            hierarchical: { enabled: false }
        };
        options.physics = {
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -100,
                centralGravity: 0.005,
                springLength: 150,
                springConstant: 0.05
            }
        };
    }
    return options;
}

// Fetch Search Index
async function loadSearchIndex() {
    try {
        const response = await fetch(`./data/index.json?_t=${Date.now()}`);
        if (!response.ok) throw new Error("Index file not found");
        const data = await response.json();
        allNodesIndex = data.nodes || [];

        // Load initial entry point if specified or first in index
        if (allNodesIndex.length > 0) {
            const entryId = allNodesIndex[0].id; // "genesis" usually
            await fetchAndAddNode(entryId);
            // Center the camera on the first node
            setTimeout(() => {
                network.focus(entryId, { scale: 1.2, animation: true });
            }, 500);

            // Background load everything else so timeline works smoothly
            setTimeout(async () => {
                const loadPromises = allNodesIndex.map(n => {
                    if (n.id !== entryId) return fetchAndAddNode(n.id);
                });
                await Promise.all(loadPromises);
                updateGraphByTimeline();
            }, 1000);
        }
    } catch (error) {
        console.error("No index.json found, or failed to fetch", error);
        // We can tolerate no index, just means no autocomplete.
        // Fallback to fetch 'genesis' directly
        try {
            await fetchAndAddNode('genesis');
        } catch (e) {
            console.log("No genesis node loaded.");
        }
    }
}

// Fetch and add node from markdown
async function fetchAndAddNode(id) {
    if (loadedNodes.has(id)) return; // Prevent infinite loop

    try {
        const response = await fetch(`./data/${id}.md?_t=${Date.now()}`);
        if (!response.ok) throw new Error(`Node ${id} not found`);
        const text = await response.text();

        // Parse frontmatter
        const result = parseMarkdownFrontmatter(text);
        const mdData = result.meta;
        const description = result.content;

        // Default values
        mdData.id = mdData.id || id;
        mdData.name = mdData.name || id;
        mdData.description = description;
        mdData.born = mdData.born ? String(mdData.born).trim() : null;
        mdData.died = mdData.died ? String(mdData.died).trim() : null;
        const relParents = parseRelationArray(mdData.parents);
        const relChildren = parseRelationArray(mdData.children);
        const relSpouses = parseRelationArray(mdData.spouses);
        const relDivorced = parseRelationArray(mdData.divorced);
        const relAdopted = parseRelationArray(mdData.adopted);
        const relAdoptedBy = parseRelationArray(mdData.adoptedBy);

        mdData.parents = relParents.clean;
        mdData.children = relChildren.clean;
        mdData.spouses = relSpouses.clean;
        mdData.divorced = relDivorced.clean;
        mdData.adopted = relAdopted.clean;
        mdData.adoptedBy = relAdoptedBy.clean;

        mdData._rawParents = relParents.raw;
        mdData._rawChildren = relChildren.raw;
        mdData._rawSpouses = relSpouses.raw;
        mdData._rawDivorced = relDivorced.raw;
        mdData._rawAdopted = relAdopted.raw;
        mdData._rawAdoptedBy = relAdoptedBy.raw;

        mdData._datesSpouses = relSpouses.dates;
        mdData._datesDivorced = relDivorced.dates;

        if (mdData.born) checkAndSetTimelineBounds(extractYear(mdData.born));
        if (mdData.died) checkAndSetTimelineBounds(extractYear(mdData.died));

        // Add to graph visually
        addVisNode(mdData);
        loadedNodes.add(id);

        // Self-heal search index name disparity
        const indexObj = allNodesIndex.find(n => n.id === id);
        if (indexObj) {
            indexObj.name = mdData.name;
        } else {
            allNodesIndex.push({ id: mdData.id, name: mdData.name });
        }

        // --- Family Node & Edge Routing ---
        function getFamId(p1, p2) {
            return 'fam-' + [p1, p2].sort().join('-');
        }

        // 1. Spouses -> create fam nodes and link both partners to it
        mdData.spouses.forEach(spouseId => {
            const famId = getFamId(id, spouseId);
            const mYear = extractYear(mdData._datesSpouses[spouseId]);
            if (mYear) checkAndSetTimelineBounds(mYear);
            if (!nodes.get(famId)) {
                nodes.add({ id: famId, shape: 'dot', size: 5, color: '#ff6b9e', title: 'Marriage', _isFam: true, _marriageYear: mYear });
            } else {
                nodes.update({ id: famId, _marriageYear: mYear });
            }
            if (!edges.get(`${id}-${famId}`)) edges.add({ id: `${id}-${famId}`, from: id, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } }, _marriageYear: mYear });
            if (!edges.get(`${spouseId}-${famId}`)) edges.add({ id: `${spouseId}-${famId}`, from: spouseId, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } }, _marriageYear: mYear });
        });

        // 1.5 Divorced -> create fam nodes and link both partners to it
        mdData.divorced.forEach(divorcedId => {
            const famId = getFamId(id, divorcedId);
            const dYear = extractYear(mdData._datesDivorced[divorcedId]);
            const mYear = mdData._datesSpouses ? extractYear(mdData._datesSpouses[divorcedId]) : null;
            if (dYear) checkAndSetTimelineBounds(dYear);
            if (mYear) checkAndSetTimelineBounds(mYear);
            if (!nodes.get(famId)) {
                nodes.add({ id: famId, shape: 'dot', size: 5, color: '#a0a0a0', title: 'Divorced', _isFam: true, _divorceYear: dYear, _marriageYear: mYear });
            } else {
                nodes.update({ id: famId, color: '#a0a0a0', title: 'Divorced', _divorceYear: dYear, _marriageYear: mYear });
            }
            if (!edges.get(`${id}-${famId}`)) {
                edges.add({ id: `${id}-${famId}`, from: id, to: famId, color: { color: '#a0a0a0' }, dashes: true, width: 2, arrows: { to: { enabled: false } }, _divorceYear: dYear, _marriageYear: mYear });
            } else {
                edges.update({ id: `${id}-${famId}`, color: { color: '#a0a0a0' }, dashes: true, _divorceYear: dYear });
            }
            if (!edges.get(`${divorcedId}-${famId}`)) {
                edges.add({ id: `${divorcedId}-${famId}`, from: divorcedId, to: famId, color: { color: '#a0a0a0' }, dashes: true, width: 2, arrows: { to: { enabled: false } }, _divorceYear: dYear, _marriageYear: mYear });
            } else {
                edges.update({ id: `${divorcedId}-${famId}`, color: { color: '#a0a0a0' }, dashes: true, _divorceYear: dYear });
            }
        });

        // 2. Parents -> link child to parent or fam node
        if (mdData.parents.length >= 2) {
            const p1 = mdData.parents[0], p2 = mdData.parents[1];
            const famId = getFamId(p1, p2);
            if (!nodes.get(famId)) {
                nodes.add({ id: famId, shape: 'dot', size: 5, color: '#ff6b9e', title: 'Marriage', _isFam: true });
            }
            // ensure parents are linked to fam
            if (!edges.get(`${p1}-${famId}`)) edges.add({ id: `${p1}-${famId}`, from: p1, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } } });
            if (!edges.get(`${p2}-${famId}`)) edges.add({ id: `${p2}-${famId}`, from: p2, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } } });

            // link fam to child
            if (!edges.get(`${famId}-child-${id}`)) edges.add({ id: `${famId}-child-${id}`, from: famId, to: id, color: { color: '#5e81ff' }, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });

            // cleanup any direct tentative edges
            if (edges.get(`${p1}-direct-${id}`)) edges.remove(`${p1}-direct-${id}`);
            if (edges.get(`${p2}-direct-${id}`)) edges.remove(`${p2}-direct-${id}`);
        } else if (mdData.parents.length === 1) {
            const p1 = mdData.parents[0];
            edges.update({ id: `${p1}-direct-${id}`, from: p1, to: id, color: { color: '#5e81ff', opacity: 1 }, dashes: false, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
        }

        // 3. Children -> draw tentative direct edges (will be cleaned up when child loads if it has 2 parents)
        mdData.children.forEach(childId => {
            if (!loadedNodes.has(childId)) {
                if (!edges.get(`${id}-direct-${childId}`)) edges.add({ id: `${id}-direct-${childId}`, from: id, to: childId, color: { color: '#5e81ff', opacity: 0.5 }, dashes: true, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
            }
        });

        // 4. Adopted Children -> draw tentative dashed edges
        mdData.adopted.forEach(adoptedId => {
            if (!loadedNodes.has(adoptedId)) {
                if (!edges.get(`${id}-adopted-${adoptedId}`)) edges.add({ id: `${id}-adopted-${adoptedId}`, from: id, to: adoptedId, color: { color: '#ff9f43', opacity: 0.5 }, dashes: [5, 3], arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
            }
        });

        // 5. Adopted By -> draw dashed edge from parent to child
        mdData.adoptedBy.forEach(parentId => {
            edges.update({ id: `${parentId}-adopted-${id}`, from: parentId, to: id, color: { color: '#ff9f43', opacity: 1 }, dashes: [5, 3], arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
        });

    } catch (error) {
        console.error("Failed to load node: " + id, error);
    }
}

function parseRelationArray(arr) {
    const res = { clean: [], raw: [], dates: {} };
    (arr || []).forEach(item => {
        const s = String(item).trim();
        if (s.includes(':')) {
            const parts = s.split(':');
            const cleanId = parts[0].trim();
            res.clean.push(cleanId);
            res.raw.push(s);
            res.dates[cleanId] = parts.slice(1).join(':').trim();
        } else {
            res.clean.push(s);
            res.raw.push(s);
        }
    });
    return res;
}

function parseMarkdownFrontmatter(text) {
    const regex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
    const match = text.match(regex);
    if (match) {
        try {
            const meta = jsyaml.load(match[1]);
            return { meta: meta, content: match[2].trim() };
        } catch (e) {
            console.error("YAML parsing error:", e);
        }
    }
    return { meta: {}, content: text };
}

function addVisNode(data) {
    let nodeObj = {
        id: data.id,
        label: data.name,
        _fullData: data // store data for UI
    };

    // If image exists, make node a circular image
    if (data.image) {
        nodeObj.shape = 'circularImage';
        nodeObj.image = data.image;
        nodeObj.size = 30; // slightly larger for images
        nodeObj.borderWidth = 3;
    }

    nodes.update(nodeObj);
}

// UI Interaction methods
async function handleNodeClick(nodeId) {
    const nodeData = nodes.get(nodeId);
    if (!nodeData) return;

    const data = nodeData._fullData;
    if (!data || nodeData._isFam) return; // not fully loaded or it's a family pseudo-node

    // Load adjacent un-fetched nodes to expand graph dynamically
    let adjacentToLoad = [];
    if (data.parents) adjacentToLoad.push(...data.parents);
    if (data.children) adjacentToLoad.push(...data.children);
    if (data.spouses) adjacentToLoad.push(...data.spouses);
    if (data.divorced) adjacentToLoad.push(...data.divorced);
    if (data.adopted) adjacentToLoad.push(...data.adopted);
    if (data.adoptedBy) adjacentToLoad.push(...data.adoptedBy);

    for (const adjId of adjacentToLoad) {
        if (!loadedNodes.has(adjId)) {
            await fetchAndAddNode(adjId);
        }
    }

    // Refresh data since edges might have changed
    showDetailsPane(data);
}

function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = String(dateStr).match(/\b(\d{4})\b/);
    if (match) return parseInt(match[1], 10);
    return null;
}

function showDetailsPane(data) {
    // Build HTML
    let html = `<h2>${data.name}</h2>`;

    if (data.born) {
        const currentYear = new Date().getFullYear();
        let age;
        let ageText = "";

        let bornYear = extractYear(data.born);
        let diedYear = data.died ? extractYear(data.died) : currentYear;

        if (data.died) {
            if (bornYear && diedYear) {
                age = diedYear - bornYear;
                ageText = ` &bull; Lived ${age} years`;
            }
            html += `<p class="subtitle" style="margin-top: 5px; margin-bottom: 15px;">${data.born} - ${data.died}${ageText}</p>`;
        } else {
            if (bornYear) {
                age = currentYear - bornYear;
                if (age > 100) { age = 100; }
                ageText = ` &bull; Age: ${age}`;
            }
            html += `<p class="subtitle" style="margin-top: 5px; margin-bottom: 15px;">Born: ${data.born}${ageText}</p>`;
        }
    }

    if (data.image) {
        html += `<img src="${data.image}" alt="${data.name}" />`;
    }
    // simple fallback markdown parser (replace newlines with <br>)
    const desc = data.description ? data.description.replace(/\n\n/g, '<br><br>') : 'No biography provided.';
    html += `<p>${desc}</p>`;

    nodeContent.innerHTML = html;

    // Set edit button context
    editNodeBtn.onclick = () => openEditModal(data);

    detailsPane.classList.remove('hidden');
}

function hideDetailsPane() {
    detailsPane.classList.add('hidden');
}

// Search Functionality
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    searchResults.innerHTML = '';

    if (query.trim() === '') {
        searchResults.classList.add('hidden');
        return;
    }

    const matches = allNodesIndex.filter(n => n.name.toLowerCase().includes(query));
    if (matches.length > 0) {
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = match.name;
            div.onclick = async () => {
                searchInput.value = match.name;
                searchResults.classList.add('hidden');
                // Ensure node is loaded
                await fetchAndAddNode(match.id);
                network.focus(match.id, { scale: 1.2, animation: true });
                network.selectNodes([match.id]);
                handleNodeClick(match.id);
            };
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    } else {
        searchResults.classList.add('hidden');
    }
});

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchResults.classList.add('hidden');
    }
});

// Mobile UI Toggles
document.getElementById('mobileSearchBtn')?.addEventListener('click', () => {
    const controls = document.getElementById('ui-controls');
    if (controls.classList.contains('expanded') && controls.classList.contains('search-only')) {
        controls.classList.remove('expanded', 'search-only');
    } else {
        controls.classList.remove('menu-only');
        controls.classList.add('expanded', 'search-only');
        document.getElementById('searchInput').focus();
    }
});

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const uiControls = document.getElementById('ui-controls');
const leftUiWrapper = document.getElementById('left-ui-wrapper'); // Added to toggle entire menu context

mobileMenuBtn.addEventListener('click', () => {
    const isCurrentlyExpanded = uiControls.classList.contains('expanded') && uiControls.classList.contains('menu-only');

    if (isCurrentlyExpanded) {
        // Close it
        uiControls.classList.remove('expanded', 'menu-only');
        leftUiWrapper.classList.remove('menu-active'); // Hides the absolute-positioned Legend
    } else {
        // Open Menu fully
        uiControls.classList.remove('search-only');
        uiControls.classList.add('expanded', 'menu-only');
        leftUiWrapper.classList.add('menu-active'); // Reveals the absolute-positioned Legend
    }
});

// Legend Toggle
document.getElementById('toggleLegendBtn')?.addEventListener('click', function () {
    const content = document.getElementById('legendContent');
    content.classList.toggle('minimized');
    this.classList.toggle('rotated');
    if (!content.classList.contains('minimized') && content.scrollHeight > 0) {
        content.style.maxHeight = content.scrollHeight + 'px';
    } else {
        content.style.maxHeight = '0px';
    }
});

// Initialize legend height for animation
window.addEventListener('load', () => {
    const content = document.getElementById('legendContent');
    if (content && !content.classList.contains('minimized')) {
        content.style.maxHeight = content.scrollHeight + 'px';
    }
});

// Layout Toggles
btnGraph.addEventListener('click', () => {
    if (!isTreeView) return;
    isTreeView = false;
    btnGraph.classList.add('active');
    btnTree.classList.remove('active');
    network.setOptions(getNetworkOptions());
});

btnTree.addEventListener('click', async () => {
    if (isTreeView) return;
    isTreeView = true;
    btnTree.classList.add('active');
    btnGraph.classList.remove('active');

    // To prevent vis-network from crashing due to edge references to unloaded nodes during hierarchical layout,
    // and to ensure the user actually gets a full 'Tree' view, we must load all nodes first.
    const loadPromises = allNodesIndex.map(n => fetchAndAddNode(n.id));
    await Promise.all(loadPromises);

    network.setOptions(getNetworkOptions());
});

// Timeline Logic
function updateGraphByTimeline() {
    if (!nodes || !edges) return;

    timelineYearDisplay.innerText = timelineYear;

    const nodesToUpdate = [];
    nodes.forEach(node => {
        let isVisible = true;
        let changes = {};

        if (node._isFam) {
            if (node._marriageYear && timelineYear < node._marriageYear) {
                isVisible = false;
            }
            if (node._divorceYear) {
                if (timelineYear >= node._divorceYear) {
                    changes.color = '#a0a0a0';
                    changes.title = 'Divorced';
                    isVisible = true;
                } else {
                    changes.color = '#ff6b9e';
                    changes.title = 'Marriage';
                    if (node._marriageYear && timelineYear < node._marriageYear) {
                        isVisible = false;
                    }
                }
            }
        } else {
            if (node._fullData && node._fullData.born) {
                const born = extractYear(node._fullData.born);
                if (born && timelineYear < born) {
                    isVisible = false;
                }
            }
        }

        if (node.hidden !== !isVisible) changes.hidden = !isVisible;

        if (Object.keys(changes).length > 0) {
            changes.id = node.id;
            nodesToUpdate.push(changes);
        }
    });

    const edgesToUpdate = [];
    edges.forEach(edge => {
        let isVisible = true;
        let changes = {};

        if (edge._marriageYear && timelineYear < edge._marriageYear) {
            isVisible = false;
        }

        if (edge._divorceYear) {
            if (timelineYear >= edge._divorceYear) {
                changes.color = { color: '#a0a0a0' };
                changes.dashes = true;
                isVisible = true; // Divorce implies they were married
            } else {
                changes.color = { color: '#ff6b9e' };
                changes.dashes = false;
                if (edge._marriageYear && timelineYear < edge._marriageYear) {
                    isVisible = false;
                }
            }
        }

        if (edge.hidden !== !isVisible) changes.hidden = !isVisible;

        if (Object.keys(changes).length > 0) {
            changes.id = edge.id;
            edgesToUpdate.push(changes);
        }
    });

    if (nodesToUpdate.length) nodes.update(nodesToUpdate);
    if (edgesToUpdate.length) edges.update(edgesToUpdate);
}

timelineSlider.addEventListener('input', (e) => {
    timelineYear = parseInt(e.target.value, 10);
    updateGraphByTimeline();
});

playTimelineBtn.addEventListener('click', async () => {
    if (loadedNodes.size < allNodesIndex.length) {
        const loadPromises = allNodesIndex.map(n => fetchAndAddNode(n.id));
        await Promise.all(loadPromises);
    }

    if (isPlayingTimeline) {
        isPlayingTimeline = false;
        playTimelineBtn.innerText = "▶ Play";
        clearInterval(playInterval);
    } else {
        isPlayingTimeline = true;
        playTimelineBtn.innerText = "⏸ Pause";

        if (timelineYear >= parseInt(timelineSlider.max, 10)) {
            timelineYear = parseInt(timelineSlider.min, 10);
            timelineSlider.value = timelineYear;
            updateGraphByTimeline();
        }

        playInterval = setInterval(() => {
            if (timelineYear < parseInt(timelineSlider.max, 10)) {
                timelineYear++;
                timelineSlider.value = timelineYear;
                updateGraphByTimeline();
            } else {
                isPlayingTimeline = false;
                playTimelineBtn.innerText = "▶ Play";
                clearInterval(playInterval);
            }
        }, 1000); // 1 year per second
    }
});

closeDetailsBtn.addEventListener('click', hideDetailsPane);

// Add / Edit Modal Logic
addNodeBtn.addEventListener('click', () => {
    openEditModal(null);
});

cancelEditBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
});

function openEditModal(existingData) {
    if (existingData) {
        modalTitle.innerText = "Edit " + existingData.name;
        document.getElementById('nodeId').value = existingData.id;
        document.getElementById('nodeId').readOnly = true;
        document.getElementById('nodeName').value = existingData.name;
        document.getElementById('nodeBorn').value = existingData.born || '';
        document.getElementById('nodeDied').value = existingData.died || '';
        document.getElementById('nodeImage').value = existingData.image || '';
        document.getElementById('nodeParents').value = (existingData._rawParents || []).join(', ');
        document.getElementById('nodeChildren').value = (existingData._rawChildren || []).join(', ');
        document.getElementById('nodeAdopted').value = (existingData._rawAdopted || []).join(', ');
        document.getElementById('nodeAdoptedBy').value = (existingData._rawAdoptedBy || []).join(', ');
        document.getElementById('nodeSpouses').value = (existingData._rawSpouses || []).join(', ');
        document.getElementById('nodeDivorced').value = (existingData._rawDivorced || []).join(', ');
        document.getElementById('nodeDescription').value = existingData.description || '';
    } else {
        modalTitle.innerText = "Create Relative Detail";
        document.getElementById('nodeForm').reset();
        document.getElementById('nodeId').readOnly = false;
    }
    editModal.classList.remove('hidden');
}

// Generate Markdown logic
nodeForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('nodeId').value.trim();
    const name = document.getElementById('nodeName').value.trim();
    const born = document.getElementById('nodeBorn').value.trim();
    const died = document.getElementById('nodeDied').value.trim();
    const image = document.getElementById('nodeImage').value.trim();

    const relParents = parseRelationArray(document.getElementById('nodeParents').value.split(',').map(s => s.trim()).filter(s => s));
    const relChildren = parseRelationArray(document.getElementById('nodeChildren').value.split(',').map(s => s.trim()).filter(s => s));
    const relAdopted = parseRelationArray(document.getElementById('nodeAdopted').value.split(',').map(s => s.trim()).filter(s => s));
    const relAdoptedBy = parseRelationArray(document.getElementById('nodeAdoptedBy').value.split(',').map(s => s.trim()).filter(s => s));
    const relSpouses = parseRelationArray(document.getElementById('nodeSpouses').value.split(',').map(s => s.trim()).filter(s => s));
    const relDivorced = parseRelationArray(document.getElementById('nodeDivorced').value.split(',').map(s => s.trim()).filter(s => s));

    const parents = relParents.clean;
    const children = relChildren.clean;
    const adopted = relAdopted.clean;
    const adoptedBy = relAdoptedBy.clean;
    const spouses = relSpouses.clean;
    const divorced = relDivorced.clean;

    const desc = document.getElementById('nodeDescription').value;

    // Build YAML manually to be clean
    let yaml = "---\n";
    yaml += `id: ${id}\n`;
    yaml += `name: "${name}"\n`;
    if (born) yaml += `born: "${born}"\n`;
    if (died) yaml += `died: "${died}"\n`;
    if (image) yaml += `image: "${image}"\n`;

    if (relParents.raw.length > 0) yaml += `parents: [${relParents.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `parents: []\n`;

    if (relChildren.raw.length > 0) yaml += `children: [${relChildren.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `children: []\n`;

    if (relAdopted.raw.length > 0) yaml += `adopted: [${relAdopted.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `adopted: []\n`;

    if (relAdoptedBy.raw.length > 0) yaml += `adoptedBy: [${relAdoptedBy.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `adoptedBy: []\n`;

    if (relSpouses.raw.length > 0) yaml += `spouses: [${relSpouses.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `spouses: []\n`;

    if (relDivorced.raw.length > 0) yaml += `divorced: [${relDivorced.raw.map(p => `"${p}"`).join(', ')}]\n`;
    else yaml += `divorced: []\n`;

    yaml += "---\n\n";
    yaml += desc;

    // Create Blob and trigger download
    const blob = new Blob([yaml], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.md`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);

    // Update live graph immediately so user feels good
    const newData = {
        id, name, born, died, image, parents, children, adopted, adoptedBy, spouses, divorced, description: desc,
        _rawParents: relParents.raw, _rawChildren: relChildren.raw, _rawAdopted: relAdopted.raw,
        _rawAdoptedBy: relAdoptedBy.raw, _rawSpouses: relSpouses.raw, _rawDivorced: relDivorced.raw,
        _datesSpouses: relSpouses.dates, _datesDivorced: relDivorced.dates
    };

    addVisNode(newData);
    loadedNodes.add(id);

    function getFamId(p1, p2) {
        return 'fam-' + [p1, p2].sort().join('-');
    }

    // Process newly updated edges similarly
    spouses.forEach(spouseId => {
        const famId = getFamId(id, spouseId);
        const mYear = extractYear(relSpouses.dates[spouseId]);
        if (mYear) checkAndSetTimelineBounds(mYear);
        if (!nodes.get(famId)) {
            nodes.add({ id: famId, shape: 'dot', size: 5, color: '#ff6b9e', title: 'Marriage', _isFam: true, _marriageYear: mYear });
        } else {
            nodes.update({ id: famId, _marriageYear: mYear });
        }
        if (!edges.get(`${id}-${famId}`)) edges.add({ id: `${id}-${famId}`, from: id, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } }, _marriageYear: mYear });
        if (!edges.get(`${spouseId}-${famId}`)) edges.add({ id: `${spouseId}-${famId}`, from: spouseId, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } }, _marriageYear: mYear });
    });

    divorced.forEach(divorcedId => {
        const famId = getFamId(id, divorcedId);
        const dYear = extractYear(relDivorced.dates[divorcedId]);
        const mYear = relSpouses.dates ? extractYear(relSpouses.dates[divorcedId]) : null;
        if (dYear) checkAndSetTimelineBounds(dYear);
        if (mYear) checkAndSetTimelineBounds(mYear);
        if (!nodes.get(famId)) {
            nodes.add({ id: famId, shape: 'dot', size: 5, color: '#a0a0a0', title: 'Divorced', _isFam: true, _divorceYear: dYear, _marriageYear: mYear });
        } else {
            nodes.update({ id: famId, color: '#a0a0a0', title: 'Divorced', _divorceYear: dYear, _marriageYear: mYear });
        }
        if (!edges.get(`${id}-${famId}`)) {
            edges.add({ id: `${id}-${famId}`, from: id, to: famId, color: { color: '#a0a0a0' }, dashes: true, width: 2, arrows: { to: { enabled: false } }, _divorceYear: dYear, _marriageYear: mYear });
        } else {
            edges.update({ id: `${id}-${famId}`, color: { color: '#a0a0a0' }, dashes: true, _divorceYear: dYear });
        }
        if (!edges.get(`${divorcedId}-${famId}`)) {
            edges.add({ id: `${divorcedId}-${famId}`, from: divorcedId, to: famId, color: { color: '#a0a0a0' }, dashes: true, width: 2, arrows: { to: { enabled: false } }, _divorceYear: dYear, _marriageYear: mYear });
        } else {
            edges.update({ id: `${divorcedId}-${famId}`, color: { color: '#a0a0a0' }, dashes: true, _divorceYear: dYear });
        }
    });

    if (parents.length >= 2) {
        const p1 = parents[0], p2 = parents[1];
        const famId = getFamId(p1, p2);
        if (!nodes.get(famId)) nodes.add({ id: famId, shape: 'dot', size: 5, color: '#ff6b9e', title: 'Marriage', _isFam: true });

        if (!edges.get(`${p1}-${famId}`)) edges.add({ id: `${p1}-${famId}`, from: p1, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } } });
        if (!edges.get(`${p2}-${famId}`)) edges.add({ id: `${p2}-${famId}`, from: p2, to: famId, color: { color: '#ff6b9e' }, width: 2, arrows: { to: { enabled: false } } });
        if (!edges.get(`${famId}-child-${id}`)) edges.add({ id: `${famId}-child-${id}`, from: famId, to: id, color: { color: '#5e81ff' }, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });

        if (edges.get(`${p1}-direct-${id}`)) edges.remove(`${p1}-direct-${id}`);
        if (edges.get(`${p2}-direct-${id}`)) edges.remove(`${p2}-direct-${id}`);
    } else if (parents.length === 1) {
        edges.update({ id: `${parents[0]}-direct-${id}`, from: parents[0], to: id, color: { color: '#5e81ff', opacity: 1 }, dashes: false, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
    }

    children.forEach(childId => {
        if (!loadedNodes.has(childId)) {
            if (!edges.get(`${id}-direct-${childId}`)) edges.add({ id: `${id}-direct-${childId}`, from: id, to: childId, color: { color: '#5e81ff', opacity: 0.5 }, dashes: true, arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
        }
    });

    adopted.forEach(adoptedId => {
        if (!loadedNodes.has(adoptedId)) {
            if (!edges.get(`${id}-adopted-${adoptedId}`)) edges.add({ id: `${id}-adopted-${adoptedId}`, from: id, to: adoptedId, color: { color: '#ff9f43', opacity: 0.5 }, dashes: [5, 3], arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
        }
    });

    adoptedBy.forEach(parentId => {
        edges.update({ id: `${parentId}-adopted-${id}`, from: parentId, to: id, color: { color: '#ff9f43', opacity: 1 }, dashes: [5, 3], arrows: { to: { enabled: true, scaleFactor: 0.5 } } });
    });

    // If it's new, add to search index
    if (!allNodesIndex.find(n => n.id === id)) {
        allNodesIndex.push({ id, name });
    }

    editModal.classList.add('hidden');
});

// Initialize on Load
window.onload = () => {
    initNetwork();
    loadSearchIndex();
};
