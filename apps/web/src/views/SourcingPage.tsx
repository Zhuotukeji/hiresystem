import { Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Candidate, Job, TargetCompany } from "../api/types";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function SourcingPage() {
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.get<ApiList<Job>>("/jobs")
  });
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<ApiList<TargetCompany>>("/target-companies")
  });
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates", "sourcing"],
    queryFn: () => api.get<ApiList<Candidate>>("/candidates?take=200")
  });

  const jobs = jobsData?.items ?? [];
  const companies = companiesData?.items ?? [];
  const candidates = candidatesData?.items ?? [];
  const openJobs = jobs.filter((job) => job.status === "OPEN");
  const priorityJobs = openJobs.filter((job) => ["P0", "P1"].includes(job.priority));
  const activeJob = jobs.find((job) => job.id === selectedJobId) ?? priorityJobs[0] ?? openJobs[0] ?? jobs[0];

  const recommendedCompanies = useMemo(
    () =>
      activeJob
        ? companies
            .map((company) => ({ company, score: scoreCompanyForJob(company, activeJob) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.company)
        : companies,
    [activeJob, companies]
  );

  const candidateLeads = useMemo(
    () =>
      activeJob
        ? candidates
            .map((candidate) => ({ candidate, score: scoreCandidateForJob(candidate, activeJob, recommendedCompanies) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.candidate)
        : candidates,
    [activeJob, candidates, recommendedCompanies]
  );

  const bossCount = candidates.filter((candidate) => candidate.sourceChannel?.toLowerCase().includes("boss")).length;
  const nonBossRate = candidates.length ? Math.round(((candidates.length - bossCount) / candidates.length) * 100) : 0;
  const targetCompanyCandidates = companies.reduce((sum, company) => sum + (company._count?.candidates ?? 0), 0);
  const toContactCandidates = candidates.filter((candidate) => ["NEW", "TO_CONTACT", "CONTACTED"].includes(candidate.status));

  return (
    <div className="page">
      <PageHeader title="主动寻访工作台" desc="围绕目标公司和岗位画像主动找人，降低对 BOSS 简历的依赖。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="开放岗位" value={openJobs.length} loading={jobsLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="P0/P1岗位" value={priorityJobs.length} loading={jobsLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="目标公司" value={companies.length} loading={companiesLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="目标公司候选人" value={targetCompanyCandidates} loading={companiesLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="非BOSS占比" value={nonBossRate} suffix="%" loading={candidatesLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="待触达线索" value={toContactCandidates.length} loading={candidatesLoading} />
          </Card>
        </Col>
      </Row>

      <Card
        title="按岗位生成寻访视图"
        style={{ marginTop: 16 }}
        extra={
          <Select
            value={activeJob?.id}
            style={{ width: 300 }}
            placeholder="选择岗位"
            options={priorityJobs.concat(openJobs.filter((job) => !priorityJobs.some((item) => item.id === job.id))).map((job) => ({
              value: job.id,
              label: `${job.priority} · ${job.title}`
            }))}
            onChange={setSelectedJobId}
          />
        }
      >
        {activeJob ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text>
              当前岗位：<Link to={`/jobs/${activeJob.id}`}>{activeJob.title}</Link>
            </Typography.Text>
            <Space wrap>
              {(activeJob.profile?.mustHaveSkills ?? []).map((skill) => (
                <Tag key={skill}>{skill}</Tag>
              ))}
              {(activeJob.profile?.targetCompanies ?? []).map((company) => (
                <Tag color="blue" key={company}>{company}</Tag>
              ))}
            </Space>
          </Space>
        ) : (
          <Typography.Text type="secondary">还没有开放岗位。</Typography.Text>
        )}
      </Card>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="推荐目标公司">
          <Table
            rowKey="id"
            size="small"
            loading={companiesLoading}
            pagination={{ pageSize: 8 }}
            dataSource={recommendedCompanies}
            columns={[
              { title: "公司", dataIndex: "name" },
              { title: "类型", dataIndex: "companyType" },
              { title: "评级", dataIndex: "talentQualityLevel", render: (value) => <Tag>{value ?? "未评级"}</Tag> },
              { title: "候选人", render: (_, record) => record._count?.candidates ?? 0 },
              {
                title: "标签",
                render: (_, record) => (
                  <Space wrap>
                    {[...(record.businessTags ?? []), ...(record.techTags ?? [])].slice(0, 3).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                )
              }
            ]}
          />
        </Card>
        <Card title="候选人线索">
          <Table
            rowKey="id"
            size="small"
            loading={candidatesLoading}
            pagination={{ pageSize: 8 }}
            dataSource={candidateLeads}
            columns={[
              { title: "姓名", dataIndex: "name", render: (text, record) => <Link to={`/candidates/${record.id}`}>{text}</Link> },
              { title: "公司", dataIndex: "currentCompanyName" },
              { title: "职位", dataIndex: "currentTitle" },
              { title: "来源", dataIndex: "sourceChannel", render: (value) => value ?? "-" },
              { title: "状态", dataIndex: "status" },
              {
                title: "最新判断",
                render: (_, record) => {
                  const latest = record.evaluations?.[0];
                  return <ScoreTag level={latest?.level} score={latest?.matchScore} />;
                }
              }
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function scoreCompanyForJob(company: TargetCompany, job: Job) {
  const profile = job.profile;
  let score = 0;
  const companyName = company.name.toLowerCase();
  const targetCompanyHit = profile?.targetCompanies?.some((item) => {
    const normalized = item.toLowerCase();
    return companyName.includes(normalized) || normalized.includes(companyName);
  });
  if (targetCompanyHit) score += 100;
  if (company.targetRoles?.some((role) => role.includes(job.title) || job.title.includes(role))) score += 30;
  const tags = [...(company.techTags ?? []), ...(company.businessTags ?? [])].map((tag) => tag.toLowerCase());
  const skillHits = (profile?.mustHaveSkills ?? []).filter((skill) => tags.some((tag) => tag.includes(skill.toLowerCase())));
  score += skillHits.length * 10;
  if (company.sourcingPriority === "P0") score += 8;
  if (company.talentQualityLevel === "A") score += 6;
  return score;
}

function scoreCandidateForJob(candidate: Candidate, job: Job, companies: TargetCompany[]) {
  let score = 0;
  const companyNames = companies.map((company) => company.name);
  if (candidate.currentCompanyName && companyNames.includes(candidate.currentCompanyName)) score += 50;
  if (candidate.currentTitle && (candidate.currentTitle.includes(job.title) || job.title.includes(candidate.currentTitle))) score += 20;
  const haystack = `${candidate.resumeText ?? ""} ${(candidate.tags ?? []).join(" ")} ${candidate.currentTitle ?? ""}`.toLowerCase();
  for (const skill of job.profile?.mustHaveSkills ?? []) {
    if (haystack.includes(skill.toLowerCase())) score += 8;
  }
  if (!candidate.sourceChannel?.toLowerCase().includes("boss")) score += 5;
  return score;
}
