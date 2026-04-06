export interface Resume {
  title: string;
  content: string;
}

export interface IResumeService {
  getResumes: () => Promise<Resume[]>,
}
