import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Trash2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { exportToCSV } from '@/lib/csv'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { logDashboardActivity } from '@/lib/audit'

export function SalesChannelsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<any>(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: channels, isLoading } = useQuery({
    queryKey: ['sales-channels', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales_channels')
        .select('*')
        .order('name')

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const deleteChannel = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      // Check if channel has any channel pricing
      const { data: channelPricing, error: checkError } = await supabase
        .from('channel_pricing')
        .select('id')
        .eq('channel_id', id)
        .limit(1)

      if (checkError) throw checkError
      if (channelPricing && channelPricing.length > 0) {
        throw new Error(`Cannot delete channel "${name}" - it has pricing rules. Delete or reassign pricing first.`)
      }

      const { error } = await supabase.from('sales_channels').delete().eq('id', id)
      if (error) throw error
      return { id, name }
    },
    onSuccess: async ({ id, name }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
      if (user) {
        await logDashboardActivity({
          entityType: 'sales_channel',
          action: 'delete',
          userId: user.id,
          entityId: id,
          description: `Deleted sales channel ${name}`,
          metadata: { channel_name: name },
        })
      }
      toast.success('Sales channel deleted')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete sales channel')
    },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Channels</h1>
          <p className="text-muted-foreground">Manage your sales channels and commissions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            if (!channels?.length) return
            exportToCSV(channels, 'sales-channels', [
              { key: 'name', header: 'Channel Name' },
              { key: 'commission_percent', header: 'Commission %' },
              { key: 'status', header: 'Status' },
            ])
            toast.success('Sales channels exported')
          }} disabled={!channels?.length}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingChannel(null) }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingChannel ? 'Edit Sales Channel' : 'Add Sales Channel'}</DialogTitle>
              </DialogHeader>
              <SalesChannelForm
                defaultValues={editingChannel}
                onSuccess={() => { setDialogOpen(false); setEditingChannel(null) }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sales channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {channels && (
          <span className="text-sm text-muted-foreground">{channels.length} channel{channels.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel Name</TableHead>
                <TableHead className="text-right">Commission %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No sales channels found.
                  </TableCell>
                </TableRow>
              ) : (
                channels?.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell className="text-right font-mono">{Number(channel.commission_percent).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={channel.status === 'active' ? 'success' : 'secondary'}>
                        {channel.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingChannel(channel)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (!confirm(`Permanently delete sales channel "${channel.name}"? This cannot be undone.`)) return
                            deleteChannel.mutate({ id: channel.id, name: channel.name })
                          }}
                          disabled={deleteChannel.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function SalesChannelForm({ defaultValues, onSuccess }: { defaultValues?: any; onSuccess: () => void }) {
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [commissionPercent, setCommissionPercent] = useState(defaultValues?.commission_percent ?? '15')
  const [status, setStatus] = useState<string>(defaultValues?.status ?? 'active')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Channel name is required')
      const commission = Number(commissionPercent)
      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        throw new Error('Commission percent must be between 0 and 100')
      }

      const payload: {
        name: string
        commission_percent: number
        status: 'active' | 'inactive'
      } = {
        name: name.trim(),
        commission_percent: commission,
        status: status as 'active' | 'inactive',
      }

      if (defaultValues?.id) {
        const { error } = await supabase.from('sales_channels').update(payload).eq('id', defaultValues.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sales_channels').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
      toast.success(defaultValues ? 'Sales channel updated' : 'Sales channel created')
      onSuccess()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Channel Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Amazon, Walmart, Shopify" />
      </div>
      <div className="space-y-2">
        <Label>Commission Percentage *</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={commissionPercent}
            onChange={(e) => setCommissionPercent(e.target.value)}
            placeholder="15"
          />
          <span className="text-muted-foreground font-mono">%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Commission will be deducted from sales on this channel
        </p>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : defaultValues ? 'Update Channel' : 'Create Channel'}
      </Button>
    </div>
  )
}
