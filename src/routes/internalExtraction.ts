import { Router } from 'express';
import { ExtractionStatus } from '@prisma/client';
import { prisma } from '../db/prisma';

export const internalExtractionRouter = Router();

internalExtractionRouter.get('/internal/extraction/stats', async (_req, res) => {
  const [totalPostings, totalExtracted, totalFailed, topSkillGroups] = await Promise.all([
    prisma.posting.count(),
    prisma.posting.count({ where: { extractionStatus: ExtractionStatus.PROCESSED } }),
    prisma.posting.count({ where: { extractionStatus: ExtractionStatus.FAILED } }),
    prisma.postingSkill.groupBy({
      by: ['skillId'],
      _count: { skillId: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: 10,
    }),
  ]);

  const skills = await prisma.skill.findMany({
    where: { id: { in: topSkillGroups.map((group) => group.skillId) } },
  });
  const skillNameById = new Map(skills.map((skill) => [skill.id, skill.name]));

  const topSkills = topSkillGroups.map((group) => ({
    name: skillNameById.get(group.skillId) ?? 'unknown',
    count: group._count.skillId,
  }));

  res.json({
    totalPostings,
    totalExtracted,
    totalPending: totalPostings - totalExtracted - totalFailed,
    totalFailed,
    topSkills,
  });
});
