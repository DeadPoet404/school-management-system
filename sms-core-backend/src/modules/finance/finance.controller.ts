import { Request, Response } from 'express';
import { FinanceService } from './finance.service';

const financeService = new FinanceService();

export class FinanceController {
  /**
   * EXISTING: GET /api/finance/fee-structures
   */
  getGlobalFeeMatrix = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await financeService.getGlobalMatrix();
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to retrieve fee configurations.' 
      });
    }
  };

  /**
   * EXISTING: POST /api/finance/fee-structures
   */
  saveFeeMatrix = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing fee matrix payload." 
        });
      }

      await financeService.replaceGlobalMatrix(data);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Fee matrices updated successfully.' 
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to store fee configurations.' 
      });
    }
  };

  /**
   * EXISTING: GET /api/finance/collections/:sectionId
   */
  getSectionLedger = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sectionId } = req.params;
      const history = await financeService.getInflowLedgerBySection(sectionId);
      return res.status(200).json({ success: true, data: history });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to retrieve transaction entries.' 
      });
    }
  };

  /**
   * EXISTING: POST /api/finance/collections (Now upgraded behind the scenes!)
   */
  commitInflow = async (req: Request, res: Response): Promise<Response> => {
    try {
      const record = await financeService.processInflowCollection(req.body);
      return res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to process transaction validation.' 
      });
    }
  };

  /**
   * NEW: GET /api/finance/students-by-section/:sectionId
   */
  getStudentsBySection = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sectionId } = req.params;
      const students = await financeService.getStudentsBySection(sectionId);
      return res.status(200).json({ success: true, data: students });
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to retrieve student list.' 
      });
    }
  };

  /**
   * NEW: POST /api/finance/generate-invoices
   */
    generateInvoices = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { sectionId } = req.body;

      if (!sectionId) {
        return res.status(400).json({ success: false, message: "Missing sectionId payload." });
      }

      const result = await financeService.generateInvoicesForSection(sectionId);
      
      // Explicitly map the result to prevent key overwrites
      return res.status(201).json({ 
        success: true, 
        message: result.message,
        totalAmount: result.totalAmount
      });
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to execute invoice generation pipeline.' 
      });
    }
  };
    /**
   * NEW: GET /api/finance/ledgers
   */
  getLedgers = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await financeService.getAllLedgers();
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * NEW: POST /api/finance/ledgers
   */
  createLedger = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await financeService.createLedger(req.body);
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, message: "An account with this code already exists." });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * NEW: GET /api/finance/payroll
   */
  getPayroll = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await financeService.getCombinedPayroll();
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * NEW: PATCH /api/finance/payroll
   */
  disbursePayroll = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: "Missing payroll record ID." });

      await financeService.disbursePayroll(id);
      
      // Fetch fresh data to return to frontend
      const data = await financeService.getCombinedPayroll();
      const ledgers = await financeService.getAllLedgers();
      
      return res.status(200).json({ success: true, data: { payroll: data, ledgers } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}