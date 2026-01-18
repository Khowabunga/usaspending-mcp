/**
 * REST API endpoint for searching contractors/recipients
 * This wraps the MCP tool functionality for GPT Actions compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUSASpendingClient } from '../../../src/clients/usaspending';
import { buildAwardFilters } from '../../../src/builders/filter-builder';
import { AWARD_FIELDS, transformAwardResult } from '../../../src/builders/field-mapper';

const client = createUSASpendingClient();

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name');
		const limit = parseInt(searchParams.get('limit') || '10');

		if (!name) {
			return NextResponse.json(
				{ error: 'name query parameter is required' },
				{ status: 400 }
			);
		}

		// Search for the contractor's awards
		const filters = buildAwardFilters({
			recipientName: name,
			// Default to last 3 years
			activityStartDate: (() => {
				const date = new Date();
				date.setFullYear(date.getFullYear() - 3);
				return date.toISOString().split('T')[0];
			})(),
			activityEndDate: new Date().toISOString().split('T')[0],
		});

		const result = await client.searchAwards({
			filters,
			fields: AWARD_FIELDS,
			limit: Math.min(limit, 50),
			page: 1,
			sort: "Award Amount",
			order: "desc",
		});

		const awards = result.results || [];

		// Aggregate statistics
		const totalAmount = awards.reduce((sum, a) => sum + (Number(a["Award Amount"]) || 0), 0);
		const agencies = [...new Set(awards.map(a => a["awarding_toptier_agency_name"]).filter(Boolean))];
		const naicsCodes = [...new Set(awards.map(a => a["NAICS Code"]).filter(Boolean))];

		return NextResponse.json({
			search_term: name,
			total_awards_found: result.page_metadata?.total || 0,
			showing: awards.length,
			statistics: {
				total_award_amount: totalAmount,
				award_count: awards.length,
				average_award: awards.length > 0 ? totalAmount / awards.length : 0,
				top_agencies: agencies.slice(0, 5),
				naics_codes: naicsCodes.slice(0, 10),
			},
			recent_awards: awards.map(transformAwardResult),
		});
	} catch (error) {
		console.error('[API] search-recipients GET error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const name = body.name || body.recipientName;
		const limit = body.limit || 10;

		if (!name) {
			return NextResponse.json(
				{ error: 'name field is required' },
				{ status: 400 }
			);
		}

		// Search for the contractor's awards
		const filters = buildAwardFilters({
			recipientName: name,
			naicsCodes: body.naicsCodes,
			agencyName: body.agencyName,
			activityStartDate: body.activityStartDate || (() => {
				const date = new Date();
				date.setFullYear(date.getFullYear() - 3);
				return date.toISOString().split('T')[0];
			})(),
			activityEndDate: body.activityEndDate || new Date().toISOString().split('T')[0],
		});

		const result = await client.searchAwards({
			filters,
			fields: AWARD_FIELDS,
			limit: Math.min(limit, 50),
			page: 1,
			sort: "Award Amount",
			order: "desc",
		});

		const awards = result.results || [];

		// Aggregate statistics
		const totalAmount = awards.reduce((sum, a) => sum + (Number(a["Award Amount"]) || 0), 0);
		const agencies = [...new Set(awards.map(a => a["awarding_toptier_agency_name"]).filter(Boolean))];
		const naicsCodes = [...new Set(awards.map(a => a["NAICS Code"]).filter(Boolean))];

		return NextResponse.json({
			search_term: name,
			total_awards_found: result.page_metadata?.total || 0,
			showing: awards.length,
			statistics: {
				total_award_amount: totalAmount,
				award_count: awards.length,
				average_award: awards.length > 0 ? totalAmount / awards.length : 0,
				top_agencies: agencies.slice(0, 5),
				naics_codes: naicsCodes.slice(0, 10),
			},
			recent_awards: awards.map(transformAwardResult),
		});
	} catch (error) {
		console.error('[API] search-recipients POST error:', error);
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
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}
