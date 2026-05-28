export interface Sermon {
  id: string;
  title: string;
  speaker: string;
  date: Date;
  series?: string;
  seriesOrder?: number;
  description: string;
  scriptureReferences: string[];
  audioUrl?: string;
  videoUrl?: string;
  notes?: string;
  outline?: string;
  aiSummary?: string;
  aiKeyTakeaways?: string[];
  tags: string[];
  published: boolean;
  podcastInclude: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SermonSeries {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startDate: Date;
  endDate?: Date;
  sermons: string[];
  createdAt: Date;
  updatedAt: Date;
}
