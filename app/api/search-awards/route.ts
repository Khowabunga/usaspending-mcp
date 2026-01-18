/**
 * REST API endpoint for searching federal contract awards
 * This wraps the MCP tool functionality for GPT Actions compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUSASpendingClient } from '../../../src/clients/usaspending';
import { buildAwardFilters } from '../../../src/builders/filter-builder';
import { AWARD_FIELDS, transformAwardResult } from '../../../src/builders/field-mapper';

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
			minAmount: body.minAmount,
			maxAmount: body.maxAmount,
			state: body.state,
			awardTypeCodes: body.awardTypeCodes,
			setAsideTypes: body.setAsideTypes,
			extentCompeted: body.extentCompeted,
			contractPricingTypes: body.contractPricingTypes,
		});

		const searchParams = {
			filters,
			fields: AWARD_FIELDS,
			limit: body.limit || 10,
			page: body.page || 1,
			sort: body.sort || "Award Amount",
			order: (body.order || "desc") as "asc" | "desc",
		};

		const result = await client.searchAwards(searchParams);

		return NextResponse.json({
			summary: `Found ${result.page_metadata?.total || 0} awards (showing ${result.results?.length || 0})`,
			total: result.page_metadata?.total || 0,
			page: result.page_metadata?.page || 1,
			hasNext: result.page_metadata?.hasNext || false,
			awards: result.results?.map(transformAwardResult) || [],
		});
	} catch (error) {
		console.error('[API] search-awards error:', error);
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
