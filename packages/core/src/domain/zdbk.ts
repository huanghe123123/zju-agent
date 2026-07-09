/** 本科教务网 (zdbk.zju.edu.cn) 领域类型 */

export type TimetableEntry = {
  id: string;
  courseName: string;
  teacher?: string;
  location?: string;
  weekday: number;
  startSection: number;
  endSection: number;
  weeks: number[];
  semester: string;
  /** 子学期标签：秋冬学期内的"秋"/"冬"，春夏学期内的"春"/"夏" */
  subSemester?: string;
  rawTimeText?: string;
};

export type Exam = {
  id: string;
  courseName: string;
  time?: string;
  location?: string;
  seat?: string;
  semester?: string;
};

/** 成绩（教务网）。字段参照 CeleChron Grade（lib/model/grade.dart） */
export type Grade = {
  id: string;
  courseName: string;
  /** 学分 */
  credit: number;
  /** 原始成绩：可能是百分制数字，也可能是 "优秀/良好/A+/合格/弃修" 等等级 */
  original: string;
  /** 五分制绩点 */
  fivePoint: number;
  /** 学期标识，如 "2024-2025-2"；从 xkkh 切片得到 */
  semester: string;
  /** 是否计入 GPA（弃修/待录/缓考/无效/合格/不合格/体网课不计） */
  gpaIncluded: boolean;
  /** 是否计入学分（弃修/待录/缓考/无效不计） */
  creditIncluded: boolean;
};
