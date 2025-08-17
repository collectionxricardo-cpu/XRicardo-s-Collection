export interface Comment {
  id: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  content: string;
  createdAt: string;
}

// Extends Comment with info about the link it belongs to
export interface EnhancedComment extends Comment {
    linkId: string;
    linkTitle: string;
}


export type FileType = 
    | 'pelicula-mkv-mp4' 
    | 'pelicula-iso' 
    | 'serie-mkv-mp4' 
    | 'serie-iso' 
    | 'documental-mkv-mp4' 
    | 'documental-iso';

export interface DownloadInput {
  title: string;
  imageUrl: string;
  fileType: FileType;
  downloadUrl: string;
  description?: string;
}

export interface Download extends DownloadInput {
  id: string;
  createdAt: string;
  comments: Comment[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl: string;
  password?: string;
  createdAt?: string;
  points?: number;
}

export interface Settings {
    isRegistrationOpen: boolean;
    announcement: string;
}

export interface CommunityLinkInput {
  title: string;
  url: string;
  fileType: FileType;
  description?: string;
}

export interface CommunityLink extends CommunityLinkInput {
  id: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string;
  }
  comments: Comment[];
}
