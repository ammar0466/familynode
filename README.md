# Salsilah Family Graph

An interactive, auto-evolving family tree visualization web application built with HTML, JS, and Vis.js. **Salsilah** uniquely focuses on an astronomical spatial-graph approach instead of traditional rigid hierarchies, mapping out expansive, complex relationships using a dynamic gravity physics engine. 

![Salsilah UI](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop)

## ✨ Features
* **Dynamic Physics Graph**: Unlike rigid tree views, relationships organically float and map themselves out using `Vis-Network`'s physics engine.
* **Timeline Evolution (Scrubber)**: Watch your family grow chronologically! Drag the timeline slider at the bottom of the screen to smoothly hide/reveal descendants based on their birth years.
* **Temporal Relationships**: Marriages and divorces connect perfectly to the timeline. A solid pink marriage connection will accurately sever into a dotted grey divorce line in the exact year the relationship ended.
* **Instant Background Loading**: Background lazy-loading recursively fetches every node secretly upon load, eliminating broken connection lines and ensuring instant timeline playback.
* **Markdown Data Driven**: No complex databases. Every family member is exactly one `.md` Markdown file containing YAML frontmatter. Adding a sibling is as easy as creating a generic text file.
* **Adoption Support**: Seamlessly accommodates adoptive parents and children with specific orange-dashed relationship indicators. 
* **Dual View**: For traditionalists, instantly toggle between the physics-gravity map and a strict top-down Hierarchical Tree via the bottom control pane. 

<br>

## 🚀 How to Run Locally

Because Salsilah loads `.md` and `.json` files locally via JavaScript `fetch()`, most browsers will block it if you just double-click `index.html` due to CORS security policies.

You need to serve it over a local, lightweight server. If you have Python installed, simply run this in your terminal from the project folder:

```bash
python3 -m http.server 9999
```
Then open `http://localhost:9999` in your web browser.

<br>

## 📖 Managing Data

All family data lives inside the `/data/` folder. Creating a new relative is a two step process:

### 1. Create their Profile (`data/[ID].md`)
Create a new markdown file named exactly as their unique ID (no spaces or special characters). e.g., `janedoe.md`.

Inside, add their details using standard YAML frontmatter, leaving any blanks empty `[]`:
```yaml
---
id: janedoe
name: Jane Doe
born: 1980
died: 2025 # Optional
image: "./data/image/jane.jpg" # URL or local path
parents: ["johndoe", "marysmith"]
children: []
adopted: []
adoptedBy: []
spouses: ["jimmymac:2005"] # The year they married (Optional)
divorced: ["jimmymac:2010"] # The year they divorced (Optional)
---

Jane was an aspiring software engineer.
```

### 2. Register them in the Index (`data/index.json`)
For the search bar and the background-loader to find them, you must append their exact ID and Name to the array inside `/data/index.json`. 
```json
{
    "id": "janedoe",
    "name": "Jane Doe"
}
```

<br>

## 🛠️ Technology Stack
* Pure Vanilla JavaScript (ES6)
* CSS3 & HTML5
* **[Vis.js Network](https://visjs.org/)** (Graph Engine)
* **[JS-YAML](https://github.com/nodeca/js-yaml)** (Markdown Parser)

---
*Built to chart expansive legacies securely offline.*
