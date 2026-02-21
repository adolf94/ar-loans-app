import { Chip, TableCell, TableRow } from "@mui/material"
import { ArrowRight } from "lucide-react"
import numeral from "numeral"
import { useGetUser } from "../../repositories/user"
import type { Loan } from "../../@types/types"

interface GuarantorLoansRow {
    loan : Loan
}

const GuarantorLoansRow = ({loan} : GuarantorLoansRow)=>{

    const user  =  useGetUser(loan.clientId)


    return <TableRow  hover>
                                    <TableCell>{loan.alternateId}</TableCell>
                                    <TableCell>{user?.name || loan?.clientId}</TableCell>
                                    <TableCell>${loan.principal.toLocaleString()}</TableCell>
                                    <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>
                                        {numeral(loan.balance).format("0.00")}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={loan.status}
                                            size="small"
                                            color={loan.status === 'Active' ? 'warning' : 'success'}
                                            variant="outlined"
                                            sx={{ fontWeight: 700 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <ArrowRight size={18} style={{ cursor: 'pointer', opacity: 0.5 }} />
                                    </TableCell>
                                </TableRow>
}

export default GuarantorLoansRow