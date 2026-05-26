import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface InventoryDetail {
  product: {
    id: string
    name: string
    sku: string
    product_code: string
  }
  currentLocations: Array<{
    warehouse_name: string
    quantity: number
  }>
  purchaseHistory: Array<{
    purchase_id: string
    invoice_number: string
    supplier_name: string
    invoice_date: string
    quantity_allocated: number
    unit_cost: number
    tax_percent: number
    tax_amount: number
    tax_recoverability: string
    allocated_to_warehouse: string
  }>
  totalTaxPaid: number
  totalQuantityReceived: number
}

export function InventoryDetailPage() {
  const { inventoryId: productId } = useParams()
  const navigate = useNavigate()

  const { data: details, isLoading } = useQuery({
    queryKey: ['inventory-detail', productId],
    queryFn: async (): Promise<InventoryDetail> => {
      // Get product info
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, product_code')
        .eq('id', productId)
        .single()

      if (prodError) throw prodError
      if (!product) throw new Error('Product not found')

      // Get all inventory locations for this product
      const { data: locations, error: locError } = await supabase
        .from('inventory')
        .select(`
          quantity,
          warehouse_location:warehouse_locations(name)
        `)
        .eq('product_id', product.id)
        .gt('quantity', 0)

      if (locError) throw locError

      // Get purchase history via allocations
      const { data: purchaseHist, error: purchaseError } = await supabase
        .from('purchase_allocations')
        .select(`
          quantity,
          warehouse_location:warehouse_locations(name),
          purchase_line_item:purchase_line_items(
            id,
            quantity,
            unit_cost,
            tax_percent,
            tax_amount,
            tax_recoverability,
            purchase:purchases(
              id,
              invoice_number,
              invoice_date,
              supplier:suppliers(name)
            )
          )
        `)
        .eq('purchase_line_item.product_id', product.id)

      if (purchaseError) throw purchaseError

      const purchaseHistory = (purchaseHist || []).map((alloc: any) => ({
        purchase_id: alloc.purchase_line_item.purchase.id,
        invoice_number: alloc.purchase_line_item.purchase.invoice_number,
        supplier_name: alloc.purchase_line_item.purchase.supplier.name,
        invoice_date: alloc.purchase_line_item.purchase.invoice_date,
        quantity_allocated: alloc.quantity,
        unit_cost: alloc.purchase_line_item.unit_cost,
        tax_percent: alloc.purchase_line_item.tax_percent,
        tax_amount: alloc.purchase_line_item.tax_amount,
        tax_recoverability: alloc.purchase_line_item.tax_recoverability,
        allocated_to_warehouse: alloc.warehouse_location.name,
      }))

      const totalTaxPaid = purchaseHistory.reduce((sum: number, item: any) => sum + item.tax_amount, 0)
      const totalQuantityReceived = purchaseHistory.reduce((sum: number, item: any) => sum + item.quantity_allocated, 0)

      return {
        product: product,
        currentLocations: (locations || [])
          .filter((l: any) => l.quantity > 0)
          .map((l: any) => ({
            warehouse_name: l.warehouse_location.name,
            quantity: l.quantity,
          })),
        purchaseHistory,
        totalTaxPaid,
        totalQuantityReceived,
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!details) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Inventory not found
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{details.product.name}</h1>
          <p className="text-sm text-muted-foreground">
            SKU: {details.product.sku} • Code: {details.product.product_code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{details.totalQuantityReceived} units</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tax Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(details.totalTaxPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{details.currentLocations.reduce((s, l) => s + l.quantity, 0)} units</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Stock Locations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.currentLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                    No stock
                  </TableCell>
                </TableRow>
              ) : (
                details.currentLocations.map((loc) => (
                  <TableRow key={loc.warehouse_name}>
                    <TableCell>{loc.warehouse_name}</TableCell>
                    <TableCell className="text-right font-mono">{loc.quantity}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Shows all invoices that contributed to this inventory
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Tax Type</TableHead>
                <TableHead className="text-right">Tax Amount</TableHead>
                <TableHead>Allocated To</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.purchaseHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                    No purchase history
                  </TableCell>
                </TableRow>
              ) : (
                details.purchaseHistory.map((purchase, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{purchase.invoice_number}</TableCell>
                    <TableCell>{purchase.supplier_name}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(purchase.invoice_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">{purchase.quantity_allocated}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(purchase.unit_cost)}</TableCell>
                    <TableCell>
                      {purchase.tax_percent > 0 ? (
                        <Badge variant="outline">
                          {purchase.tax_percent}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-green-600">
                      {formatCurrency(purchase.tax_amount)}
                    </TableCell>
                    <TableCell className="text-sm">{purchase.allocated_to_warehouse}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/purchases/${purchase.purchase_id}`)}
                      >
                        View Invoice
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
