/**
 * REST API endpoint for analyzing spending trends over time
 * This wraps the MCP tool functionality for GPT Actions compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUSASpendingClient } from '../../../src/clients/usaspending';
import { buildAwardFilters } from '../../../src/builders/filter-builder';

const client = createUSASpendingClient();

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Build filters using the shared filter builder
		const filters = buildAwardFilters({
			keywords: body.keywords,
			recipientName: body.recipientName,
			agencyName: body.agencyName,
			naicsCodes: body.naicsCodes,
			pscCodes: body.pscCodes,
			activityStartDate: body.activityStartDate,
			activityEndDate: body.activityEndDate,
		});

		const result = await client.getSpendingOverTime({
			filters,
			group: body.group || 'fiscal_year',
		});

		// Calculate trend direction
		const results = result.results || [];
		let trendDirection = 'stable';
		if (results.length >= 2) {
			const first = results[0]?.aggregated_amount || 0;
			const last = results[results.length - 1]?.aggregated_amount || 0;
			if (last > first * 1.1) {
				trendDirection = 'increasing';
			} else if (last < first * 0.9) {
				trendDirection = 'decreasing';
			}
		}

		return NextResponse.json({
			summary: `Spending trends grouped by ${body.group || 'fiscal_year'}`,
			group_by: body.group || 'fiscal_year',
			trend_direction: trendDirection,
			results: results.map((r: any) => ({
				time_period: r.time_period,
				aggregated_amount: r.aggregated_amount,
			})),
		});
	} catch (error) {
		console.error('[API] spending-over-time error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}
