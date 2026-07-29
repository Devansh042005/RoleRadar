import { prisma } from '../db/prisma';

// Aliases the LLM tends to still produce despite the extraction prompt's instructions.
const ALIASES: Record<string, string> = {
  'react.js': 'React',
  reactjs: 'React',
  node: 'Node.js',
  postgres: 'PostgreSQL',
  mongo: 'MongoDB',
  k8s: 'Kubernetes',
  es6: 'JavaScript',
  golang: 'Go',
};

// Names whose correct casing isn't just "capitalize the first letter".
const KNOWN_CASING: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  kubernetes: 'Kubernetes',
  graphql: 'GraphQL',
  'node.js': 'Node.js',
  github: 'GitHub',
  gitlab: 'GitLab',
};

const CATEGORY_BY_SKILL: Record<string, string> = {
  JavaScript: 'language',
  TypeScript: 'language',
  Python: 'language',
  Go: 'language',
  Java: 'language',
  Ruby: 'language',
  PHP: 'language',
  'C++': 'language',
  'C#': 'language',
  Rust: 'language',
  React: 'framework',
  Vue: 'framework',
  Angular: 'framework',
  'Node.js': 'framework',
  Express: 'framework',
  Django: 'framework',
  Flask: 'framework',
  Rails: 'framework',
  'Next.js': 'framework',
  PostgreSQL: 'database',
  MongoDB: 'database',
  MySQL: 'database',
  Redis: 'database',
  SQLite: 'database',
  DynamoDB: 'database',
  Docker: 'tool',
  Git: 'tool',
  Webpack: 'tool',
  Jest: 'tool',
  Kubernetes: 'platform',
  AWS: 'platform',
  GCP: 'platform',
  Azure: 'platform',
  Linux: 'platform',
};

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function canonicalize(rawName: string): string {
  const trimmed = rawName.trim();
  const key = trimmed.toLowerCase();
  return ALIASES[key] ?? KNOWN_CASING[key] ?? toTitleCase(trimmed);
}

function guessCategory(canonicalName: string): string | null {
  return CATEGORY_BY_SKILL[canonicalName] ?? null;
}

export async function normalizeSkill(rawName: string) {
  const canonicalName = canonicalize(rawName);

  const existing = await prisma.skill.findFirst({
    where: { name: { equals: canonicalName, mode: 'insensitive' } },
  });
  if (existing) return existing;

  return prisma.skill.create({
    data: { name: canonicalName, category: guessCategory(canonicalName) },
  });
}
