'use strict';

// Build stability table to documentation.html/json/md by generated all.json

const fs = require('fs');
const path = require('path');
const unified = require('unified');
const raw = require('rehype-raw');
const markdown = require('remark-parse');
const htmlStringify = require('rehype-stringify');
const gfm = require('remark-gfm');
const remark2rehype = require('remark-rehype');
const visit = require('unist-util-visit');

const source = `${__dirname}/../../out/doc/api`;
const data = require(path.join(source, 'all.json'));
const markBegin = '<!-- STABILITY_OVERVIEW_SLOT_BEGIN -->';
const markEnd = '<!-- STABILITY_OVERVIEW_SLOT_END -->';
const mark = `${markBegin}(.*)${markEnd}`;

const output = {
  json: path.join(source, 'stability.json'),
  docHTML: path.join(source, 'documentation.html'),
  docJSON: path.join(source, 'documentation.json'),
  docMarkdown: path.join(source, 'documentation.md'),
};

function collectStability(data) {
  const stability = [];

  for (const mod of data.modules) {
    if (mod.displayName && mod.stability >= 0) {
      const link = mod.source.replace('doc/api/', '').replace('.md', '.html');

      stability.push({
        api: mod.name,
        link: link,
        stability: mod.stability,
        stabilityText: `(${mod.stability}) ${mod.stabilityText}`,
      });
    }
  }

  stability.sort((a, b) => a.api.localeCompare(b.api));
  return stability;
}

function createMarkdownTable(data) {
  const md = ['| API | Stability |', '| --- | --------- |'];

  for (const mod of data) {
    md.push(`| [${mod.api}](${mod.link}) | ${mod.stabilityText} |`);
  }

  return md.join('\n');
}

function createHTML(md) {
  const file = unified()
    .use(markdown)
    .use(gfm)
    .use(remark2rehype, { allowDangerousHtml: true })
    .use(raw)
    .use(htmlStringify)
    .use(processStability)
    .processSync(md);

  return file.contents.trim();
}

function processStability() {
  return (tree) => {
    visit(tree, { type: 'element', tagName: 'tr' }, (node) => {
      const [api, stability] = node.children;
      if (api.tagName !== 'td') {
        return;
      }

      api.properties.class = 'module_stability';

      const level = stability.children[0].value[1];
      stability.properties.class = `api_stability api_stability_${level}`;
    });
  };
}

function updateStabilityMark(file, value, mark) {
  const fd = fs.openSync(file, 'r+');
  const content = fs.readFileSync(fd, { encoding: 'utf8' });

  const replaced = content.replace(mark, value);
  if (replaced !== content) {
    fs.writeSync(fd, replaced, 0, 'utf8');
  }
  fs.closeSync(fd);
}

const stability = collectStability(data);

// add markdown
const markdownTable = createMarkdownTable(stability);
updateStabilityMark(output.docMarkdown,
                    `${markBegin}\n${markdownTable}\n${markEnd}`,
                    new RegExp(mark, 's'));

// add html table
const html = createHTML(markdownTable);
updateStabilityMark(output.docHTML, `${markBegin}${html}${markEnd}`,
                    new RegExp(mark, 's'));

// add json output
updateStabilityMark(output.docJSON,
                    JSON.stringify(`${markBegin}${html}${markEnd}`),
                    new RegExp(JSON.stringify(mark), 's'));
