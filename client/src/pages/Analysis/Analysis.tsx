import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '@/lib/api';
import { getUserEmail } from '@/utils/userStorage';
import { Search, Plus, Calendar, FileText, MessageSquare, BarChart3, Loader2, Trash2, Edit2, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Session {
  id: string;
  username: string;
  fileName: string;
  uploadedAt: number;
  createdAt: number;
  lastUpdatedAt: number;
  messageCount: number;
  chartCount: number;
  sessionId: string;
}

interface SessionsResponse {
  sessions: Session[];
  count: number;
  message: string;
}

interface AnalysisProps {
  onNavigate?: (page: 'home' | 'dashboard' | 'analysis') => void;
  onNewChat?: () => void;
  onLoadSession?: (sessionId: string, sessionData: any) => void;
  onUploadNew?: () => void;
}

const Analysis: React.FC<AnalysisProps> = ({ onNavigate, onNewChat, onLoadSession, onUploadNew }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const userEmail = getUserEmail();
  const queryClient = useQueryClient();

  // Debug user email
  useEffect(() => {
    console.log('👤 User email:', userEmail);
  }, [userEmail]);

  // Fetch sessions data
  const { data: sessionsData, isLoading, error, refetch } = useQuery<SessionsResponse>({
    queryKey: ['sessions', userEmail], // Include userEmail in query key for proper caching
    queryFn: async () => {
      console.log('🔍 Fetching sessions from API for user:', userEmail);
      const result = await sessionsApi.getAllSessions();
      console.log('✅ Sessions API response:', result);
      return result;
    },
    enabled: !!userEmail,
    retry: 2,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Refetch when component mounts
    staleTime: 0, // Consider data stale immediately to allow refetching
  });

  // Refetch sessions when page becomes visible or when userEmail changes
  useEffect(() => {
    if (!userEmail) return;
    
    // Refetch when component mounts or userEmail changes
    // This ensures fresh data when navigating to this page
    const timeoutId = setTimeout(() => {
      refetch();
    }, 200); // Small delay to ensure component is ready
    
    // Listen for visibility changes (when tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userEmail) {
        refetch();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userEmail, refetch]);

  // Filter and sort sessions based on search query and sort order
  useEffect(() => {
    if (sessionsData?.sessions) {
      // First filter sessions
      let filtered = sessionsData.sessions.filter(session =>
        session.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      // Then sort by lastUpdatedAt
      filtered = [...filtered].sort((a, b) => {
        if (sortOrder === 'newest') {
          return b.lastUpdatedAt - a.lastUpdatedAt; // Newest first
        } else {
          return a.lastUpdatedAt - b.lastUpdatedAt; // Oldest first
        }
      });
      
      setFilteredSessions(filtered);
    }
  }, [sessionsData, searchQuery, sortOrder]);

  // Handle session click
  const handleSessionClick = async (session: Session) => {
    // Prevent multiple clicks while loading
    if (loadingSessionId) return;
    
    setLoadingSessionId(session.sessionId);
    
    try {
      console.log('🔍 Loading session details for:', session.sessionId);
      
      // Fetch session details
      const sessionDetails = await sessionsApi.getSessionDetails(session.sessionId);
      console.log('✅ Session details loaded:', sessionDetails);

      // If onLoadSession callback is provided, use it
      if (onLoadSession) {
        onLoadSession(session.sessionId, sessionDetails);
        toast({
          title: 'Session Loaded',
          description: `Analysis for ${session.fileName} is now active`,
        });
      } else {
        // Fallback: navigate to home with session data
        if (onNavigate) {
          onNavigate('home');
          toast({
            title: 'Session Selected',
            description: `Switched to analysis for ${session.fileName}`,
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error);
      toast({
        title: 'Error Loading Session',
        description: 'Failed to load session details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSessionId(null);
    }
  };

  // Handle new chat
  const handleNewChat = () => {
    if (onUploadNew) {
      onUploadNew();
    } else if (onNewChat) {
      onNewChat();
    } else if (onNavigate) {
      onNavigate('home');
    } else {
      toast({ title: 'New Analysis', description: 'Starting a new analysis session' });
    }
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation(); // Prevent card click event
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      await sessionsApi.deleteSession(sessionToDelete.sessionId);
      
      toast({
        title: 'Session Deleted',
        description: `Analysis session for ${sessionToDelete.fileName} has been deleted.`,
      });

      // Invalidate and refetch sessions
      await queryClient.invalidateQueries({ queryKey: ['sessions', userEmail] });
      refetch();

      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      toast({
        title: 'Error Deleting Session',
        description: error instanceof Error ? error.message : 'Failed to delete session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  // Handle edit button click
  const handleEditClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation(); // Prevent card click event
    setSessionToEdit(session);
    setEditFileName(session.fileName);
    setEditDialogOpen(true);
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setSessionToEdit(null);
    setEditFileName('');
  };

  // Handle edit confirmation
  const handleEditConfirm = async () => {
    if (!sessionToEdit || !editFileName.trim()) return;

    setIsUpdating(true);
    try {
      await sessionsApi.updateSessionName(sessionToEdit.sessionId, editFileName.trim());
      
      toast({
        title: 'Analysis Name Updated',
        description: `Analysis name has been updated to "${editFileName.trim()}".`,
      });

      // Invalidate and refetch sessions
      await queryClient.invalidateQueries({ queryKey: ['sessions', userEmail] });
      refetch();

      setEditDialogOpen(false);
      setSessionToEdit(null);
      setEditFileName('');
    } catch (error) {
      console.error('❌ Failed to update session name:', error);
      toast({
        title: 'Error Updating Name',
        description: error instanceof Error ? error.message : 'Failed to update analysis name. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Format file name for display
  const formatFileName = (fileName: string) => {
    if (fileName.length > 50) {
      return fileName.substring(0, 47) + '...';
    }
    return fileName;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your analysis history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Failed to load sessions</h2>
            <p className="text-gray-600 mt-2">There was an error loading your analysis history.</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10vh)] bg-gray-50 flex flex-col" data-analysis-page>
      <div className="max-w-6xl mx-40 px-6 py-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Analysis History</h1>
            <p className="text-gray-600 mt-2">
              {sessionsData?.count || 0} analysis sessions{userEmail ? ` for ${userEmail}` : ''}
            </p>
          </div>
          <Button onClick={handleNewChat} className="bg-black text-white hover:bg-gray-800">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </div>

        {/* Search Bar and Sort */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search your analyses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-500" />
            <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
              <SelectTrigger className="w-[180px] h-12 border-gray-300">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No matching analyses found' : 'No analysis sessions yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : `Welcome! Upload your first file to start analyzing data${userEmail ? ` as ${userEmail}` : ''}`
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={handleNewChat} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Start Your First Analysis
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredSessions.map((session) => {
              const isLoading = loadingSessionId === session.sessionId;
              return (
              <Card 
                key={session.id} 
                className={cn(
                  "hover:shadow-md transition-shadow border-gray-200 relative",
                  isLoading ? "cursor-wait opacity-75" : "cursor-pointer"
                )}
                onClick={() => !isLoading && handleSessionClick(session)}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <p className="text-sm text-gray-600 font-medium">Loading analysis...</p>
                    </div>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {formatFileName(session.fileName)}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {session.id.split('_')[0]}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Last analysis {formatDate(session.lastUpdatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{session.messageCount} messages</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          <span>{session.chartCount} charts</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-500">
                        <div>{new Date(session.lastUpdatedAt).toLocaleDateString()}</div>
                        <div className="text-xs">
                          {new Date(session.lastUpdatedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditClick(e, session)}
                          disabled={isLoading}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          title="Edit analysis name"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(e, session)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                          title="Delete analysis"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Analysis Name</DialogTitle>
            <DialogDescription>
              Update the name for this analysis session. This will help you identify it more easily.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Analysis Name</Label>
              <Input
                id="edit-name"
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                placeholder="Enter analysis name"
                disabled={isUpdating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editFileName.trim() && !isUpdating) {
                    handleEditConfirm();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleEditCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditConfirm}
              disabled={isUpdating || !editFileName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the analysis session
              {sessionToDelete && ` for "${sessionToDelete.fileName}"`} and all associated data,
              including messages, charts, and insights.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Analysis;