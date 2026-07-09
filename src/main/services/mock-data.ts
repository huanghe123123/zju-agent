import type { DashboardData } from "../../shared/types.js";

export function getMockDashboard(): DashboardData {
  return {
    generatedAt: new Date().toISOString(),
    deadlines: [
      {
        id: "ddl-1",
        course: "数据结构基础",
        title: "Project 2: Shortest Path",
        dueAt: "2026-07-10T23:59:00+08:00",
        source: "学在浙大",
        status: "open"
      },
      {
        id: "ddl-2",
        course: "大学英语 IV",
        title: "Unit 6 Listening Quiz",
        dueAt: "2026-07-12T18:00:00+08:00",
        source: "学在浙大",
        status: "open"
      },
      {
        id: "ddl-3",
        course: "概率论与数理统计",
        title: "第八章课后练习",
        dueAt: "2026-07-15T22:00:00+08:00",
        source: "学在浙大",
        status: "submitted"
      }
    ],
    schedule: [
      {
        id: "course-1",
        title: "计算机系统原理",
        location: "紫金港西 2-301",
        startAt: "2026-07-10T08:00:00+08:00",
        endAt: "2026-07-10T09:35:00+08:00",
        type: "course",
        teacher: "陈老师"
      },
      {
        id: "course-2",
        title: "人工智能导论",
        location: "玉泉曹光彪楼 204",
        startAt: "2026-07-10T13:15:00+08:00",
        endAt: "2026-07-10T14:50:00+08:00",
        type: "course",
        teacher: "李老师"
      },
      {
        id: "exam-1",
        title: "线性代数期末考试",
        location: "紫金港东 1B-205",
        startAt: "2026-07-18T09:00:00+08:00",
        endAt: "2026-07-18T11:00:00+08:00",
        type: "exam"
      }
    ],
    classrooms: [
      {
        id: "classroom-1",
        course: "计算机系统原理",
        title: "第 12 周直播课堂",
        kind: "live",
        startsAt: "2026-07-10T08:00:00+08:00",
        url: "https://classroom.zju.edu.cn/"
      },
      {
        id: "classroom-2",
        course: "人工智能导论",
        title: "搜索算法专题回放",
        kind: "replay",
        url: "https://classroom.zju.edu.cn/"
      },
      {
        id: "classroom-3",
        course: "概率论与数理统计",
        title: "第八章板书资料",
        kind: "material",
        url: "https://classroom.zju.edu.cn/"
      }
    ],
    resources: [
      {
        id: "res-1",
        course: "数据结构基础",
        name: "Project 2 Starter.zip",
        size: "1.8 MB",
        updatedAt: "2026-07-08T19:20:00+08:00",
        url: "mock://courses/resource/project-2"
      },
      {
        id: "res-2",
        course: "计算机系统原理",
        name: "Cache Lab 指南.pdf",
        size: "742 KB",
        updatedAt: "2026-07-07T10:15:00+08:00",
        url: "mock://courses/resource/cache-lab"
      },
      {
        id: "res-3",
        course: "大学英语 IV",
        name: "Presentation Rubric.docx",
        size: "96 KB",
        updatedAt: "2026-07-06T16:40:00+08:00",
        url: "mock://courses/resource/rubric"
      }
    ]
  };
}
