/**
 * Middleware for handling CORS and other cross-cutting concerns
 * This enables GPT Actions to call the REST API endpoints
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
	// Handle preflight OPTIONS requests
	if (request.method === 'OPTIONS') {
		return new NextResponse(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
				'Access-Control-Max-Age': '86400',
			},
		});
	}

	// Get the response
	const response = NextResponse.next();

	// Add CORS headers to all API responses
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

	return response;
}

// Only apply middleware to API routes
export const config = {
	matcher: '/api/:path*',
};
