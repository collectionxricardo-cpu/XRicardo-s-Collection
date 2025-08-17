import type { User, Download, Comment, DownloadInput, Settings, EnhancedComment, CommunityLinkInput, CommunityLink } from "@/types";
import { db } from './firebase';
import { collection, getDocs, getDoc, doc, addDoc, updateDoc, query, orderBy, serverTimestamp, arrayUnion, deleteDoc, setDoc, increment } from "firebase/firestore";

// NOTE: DUMMY DATA is no longer used directly by the app.
// It's kept here for reference or potential seeding scripts.
export const DUMMY_ADMIN: User = {
  id: 'admin-1',
  name: 'XRicardo',
  email: 'xricardocollection@gmail.com',
  role: 'ADMIN',
  avatarUrl: 'https://placehold.co/100x100.png',
  password: 'yPT9KpSzX?3t/&xW\RF(frdmC'
};

export const DUMMY_USERS: User[] = [
  // ... (dummy users are no longer used for login)
];

// --- Firestore API functions ---

// Helper to convert Firestore doc to an object
const fromFirestoreDoc = <T>(doc: any): T => {
    const data = doc.data();
    const id = doc.id;
    const result: any = { id };

    for (const key in data) {
        const value = data[key];
        if (value && typeof value.toDate === 'function') {
            result[key] = value.toDate().toISOString();
        } else {
            result[key] = value;
        }
    }

     // Ensure comments array exists and dates are strings
     if (result.comments && Array.isArray(result.comments)) {
        result.comments = result.comments.map((c: any) => ({
            ...c,
            createdAt: c.createdAt?.toDate?.().toISOString() || (c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()),
        }));
    } else if (!result.comments) {
        result.comments = [];
    }

    return result as T;
};


// Helper to convert Firestore doc to a Download object specifically
const downloadFromFirestore = (doc: any): Download => {
    return fromFirestoreDoc<Download>(doc);
};


export const getDownloads = async (): Promise<Download[]> => {
  const downloadsCol = collection(db, 'downloads');
  const q = query(downloadsCol, orderBy('title', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(downloadFromFirestore);
}

export const getDownloadById = async (id: string): Promise<Download | undefined> => {
  const docRef = doc(db, 'downloads', id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return downloadFromFirestore(docSnap);
  } else {
    return undefined;
  }
}

export const addComment = async (linkId: string, content: string, user: User): Promise<Download | undefined> => {
    const linkRef = doc(db, "downloads", linkId);

    const newComment: Omit<Comment, 'id'> & { id?: string } = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      author: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl
      },
      content: content,
      createdAt: new Date().toISOString(),
    };
  
    await updateDoc(linkRef, {
      comments: arrayUnion(newComment)
    });
  
    return getDownloadById(linkId);
}

export const deleteComment = async (linkId: string, commentId: string): Promise<void> => {
    const linkRef = doc(db, "downloads", linkId);
    const link = await getDownloadById(linkId);
    if (!link) {
      throw new Error("Link not found");
    }
  
    const updatedComments = link.comments.filter(comment => comment.id !== commentId);
  
    await updateDoc(linkRef, {
      comments: updatedComments
    });
  };

export const addDownload = async (download: DownloadInput): Promise<Download> => {
    const newDownloadData = {
        ...download,
        createdAt: serverTimestamp(),
        comments: []
    };
    const docRef = await addDoc(collection(db, "downloads"), newDownloadData);
    const docSnap = await getDoc(docRef);
    return downloadFromFirestore(docSnap);
}

export const updateDownload = async (id: string, download: Partial<DownloadInput>): Promise<Download> => {
    const docRef = doc(db, "downloads", id);
    await updateDoc(docRef, download);
    const updatedDoc = await getDoc(docRef);
    return downloadFromFirestore(updatedDoc);
};

export const deleteDownload = async (linkId: string): Promise<void> => {
    const linkRef = doc(db, "downloads", linkId);
    await deleteDoc(linkRef);
}

// --- User Functions ---

export const getUsers = async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestoreDoc<User>(doc));
}

export const deleteUser = async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
}

export const updateUserAvatar = async (userId: string, avatarUrl: string): Promise<User> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { avatarUrl });
    const updatedDoc = await getDoc(userRef);
    return fromFirestoreDoc<User>(updatedDoc);
};


// --- Settings Functions ---
const SETTINGS_DOC_ID = 'app-settings';

const getSettings = async (): Promise<Settings> => {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            isRegistrationOpen: typeof data.isRegistrationOpen === 'boolean' ? data.isRegistrationOpen : true,
            announcement: typeof data.announcement === 'string' ? data.announcement : '',
        }
    }
    // Default settings if the document doesn't exist
    return {
        isRegistrationOpen: true,
        announcement: ''
    };
};


export const getRegistrationStatus = async (): Promise<boolean> => {
    const settings = await getSettings();
    return settings.isRegistrationOpen;
};

export const setRegistrationStatus = async (isOpen: boolean): Promise<void> => {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(settingsRef, { isRegistrationOpen: isOpen }, { merge: true });
};


export const getAnnouncement = async (): Promise<string> => {
    const settings = await getSettings();
    return settings.announcement;
};

export const setAnnouncement = async (message: string): Promise<void> => {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(settingsRef, { announcement: message }, { merge: true });
};

// --- Activity/Comment Functions ---

export const getAllComments = async (): Promise<EnhancedComment[]> => {
    const allDownloads = await getDownloads();
    const allComments: EnhancedComment[] = [];

    allDownloads.forEach(download => {
        (download.comments || []).forEach(comment => {
            allComments.push({
                ...comment,
                linkId: download.id,
                linkTitle: download.title
            });
        });
    });

    // Sort comments by creation date, most recent first
    allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allComments;
};


// --- Community Link Functions ---

export const getCommunityLinks = async (): Promise<CommunityLink[]> => {
    const linksCol = collection(db, 'communityLinks');
    const q = query(linksCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestoreDoc<CommunityLink>(doc));
};

export const addCommunityLink = async (link: CommunityLinkInput, user: User): Promise<CommunityLink> => {
    const newLinkData = {
        ...link,
        author: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl
        },
        createdAt: serverTimestamp(),
        comments: [],
    };
    const docRef = await addDoc(collection(db, "communityLinks"), newLinkData);
    const docSnap = await getDoc(docRef);
    return fromFirestoreDoc<CommunityLink>(docSnap);
};

export const deleteCommunityLink = async (id: string): Promise<void> => {
    const linkRef = doc(db, 'communityLinks', id);
    await deleteDoc(linkRef);
};

export const addCommentToCommunityLink = async (linkId: string, content: string, user: User): Promise<CommunityLink> => {
    const linkRef = doc(db, "communityLinks", linkId);
    
    // 1. Get the link to find the author
    const linkSnap = await getDoc(linkRef);
    if (!linkSnap.exists()) {
        throw new Error("Community link not found");
    }
    const linkData = fromFirestoreDoc<CommunityLink>(linkSnap);
    const linkAuthorId = linkData.author.id;

    // 2. Add the comment to the link
    const newComment: Omit<Comment, 'id'> & { id?: string } = {
        id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        author: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl
        },
        content: content,
        createdAt: new Date().toISOString(),
    };

    await updateDoc(linkRef, {
        comments: arrayUnion(newComment)
    });

    // 3. Increment the link author's points
    const authorRef = doc(db, "users", linkAuthorId);
    await updateDoc(authorRef, {
        points: increment(1)
    });

    // 4. Return the updated link
    const updatedDoc = await getDoc(linkRef);
    return fromFirestoreDoc<CommunityLink>(updatedDoc);
}
