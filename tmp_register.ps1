 = @{username = " RetailerTest\; email = \retailertest@example.com\; password = \Secret123\; role = \RETAILER\}
 = | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/auth/register -Method POST -Body -ContentType \application/json\
