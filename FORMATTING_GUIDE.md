# Salsilah Data Formatting Guide

The Salsilah app uses Markdown files (`.md`) to store the profile data of every individual in the family tree. Each file is placed inside the `data/` directory.

To ensure the graph connection logic works perfectly, every file must begin with a **YAML Frontmatter** block enclosed by three dashes (`---`). The rest of the file below the frontmatter is for the person's biography description.

## Required Variables

Every profile must have at least these two attributes:

- `id`: The unique system ID for this person. No spaces or special characters allowed. (e.g., `ibrahimabdrahman`)
- `name`: The display name that shows up on the timeline and UI. (e.g., `Ibrahim Abd Rahman`)

## Optional Information Properties

- `born`: A static year (`1962`) or a full date string (`18/2/1962`) representing when the person was born. The timeline slider parses this to reveal children chronologically.
- `died`: The year (`2020`) or full date of death.
- `image`: The URL to the person's node photograph. 
  - To use a web URL: `"https://example.com/photo.jpg"`
  - To use a local image (stored in `data/image/` folder): `"./data/image/face.jpg"`

## Relationship Arrays

Connections to other people are handled via Arrays `[]`. Inside the array, you must exactly reference the `id` of the matching target person in double quotes. 

- `parents`: An array containing the IDs of the person's biological mother and father. (e.g. `["ibrahimabdrahman", "junaidahmokhtar"]`)
- `children`: An array of biological children IDs. Keep this chronological if possible.
- `adopted`: An array of IDs of children that this person legally adopted. Emits an orange dashed line in the graph. 
- `adoptedBy`: An array pointing upwards to the adoptive parents. Used for cross-referencing.

## Timeline Tracking For Marriages

Marriages and Divorces support an optional suffix `:YYYY` after the ID to indicate the **year** the event took place. This is crucial for the Timeline animation feature to build connections realistically over time.

- `spouses`: Individuals this person is currently or was previously married to.
  - **Standard format**: `spouses: ["zamhanizakaria"]` - marriage dot appears immediately.
  - **Timeline format**: `spouses: ["zamhanizakaria:1990"]` - will not appear on the graph until the slider hits 1990.
- `divorced`: Individuals this person was married to but is now divorced. 
  - **Timeline format:** `divorced: ["zamhanizakaria:2005"]` - Changes the pink marriage line into a severed grey dotted line once the year 2005 is reached. Always ensure the original marriage year is retained in the `spouses` array so the system knows when the relationship *started*.

## Complete File Example

```yaml
---
id: zamhanizakaria
name: Zamhani Zakaria
born: 1965
image: "https://images.unsplash.com/photo-1621535451998-0cbf74ab1d21?q=80&w=200&auto=format&fit=crop"
parents: []
children: []
adopted: []
adoptedBy: []
spouses: ["ibrahimabdrahman:1990"]
divorced: []
---

A short descriptive biography about Zamhani Zakaria goes here. It supports standard markdown like **bolding** and *italics*.
```
